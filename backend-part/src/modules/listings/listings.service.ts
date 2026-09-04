import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";

import {
  ContactPreference,
  ListingStatus,
} from "../../generated/prisma/client.js";
import { EntitlementsService } from "../entitlements/entitlements.service.js";
import type { CreateListingDto } from "./dto/create-listing.dto.js";
import type { ListLandlordListingsDto } from "./dto/list-landlord-listings.dto.js";
import type { UpdateAvailabilityDto } from "./dto/update-availability.dto.js";
import type { UpdateListingDto } from "./dto/update-listing.dto.js";
import {
  canEditListing,
  canUpdateAvailability,
  nextListingStatus,
  type LandlordListingAction,
} from "./listing-lifecycle.js";
import { ListingsRepository } from "./listings.repository.js";
import type {
  CreateLandlordListingInput,
  LandlordListingDto,
  LandlordListingRecord,
  UpdateLandlordListingInput,
} from "./listings.types.js";

@Injectable()
export class ListingsService {
  constructor(
    private readonly repository: ListingsRepository,
    private readonly entitlements: EntitlementsService,
  ) {}

  async create(
    landlordId: string,
    input: CreateListingDto,
  ): Promise<LandlordListingDto> {
    assertNoNullValues(input);
    requireTitle(input.titleKm, input.titleEn);
    requireAvailableCapacity(input.availableUnits, input.property.totalUnits);
    await this.entitlements.assertRestrictedSupplyActionAllowed(
      landlordId,
      "CREATE_LISTING",
    );
    const amenityIds = input.amenityIds ?? [];
    await this.assertActiveAmenities(amenityIds);
    await this.assertContactPreference(landlordId, input.contactPreference);

    const createInput: CreateLandlordListingInput = {
      landlordId,
      slug: createSlug(input.titleEn ?? input.property.name),
      property: {
        name: input.property.name,
        addressLine: input.property.addressLine,
        ...(input.property.commune ? { commune: input.property.commune } : {}),
        ...(input.property.district
          ? { district: input.property.district }
          : {}),
        ...(input.property.city ? { city: input.property.city } : {}),
        ...(input.property.countryCode
          ? { countryCode: input.property.countryCode }
          : {}),
        latitude: input.property.latitude,
        longitude: input.property.longitude,
        ...(input.property.googlePlaceId
          ? { googlePlaceId: input.property.googlePlaceId }
          : {}),
        totalUnits: input.property.totalUnits,
      },
      listing: {
        ...(input.titleKm ? { titleKm: input.titleKm } : {}),
        ...(input.titleEn ? { titleEn: input.titleEn } : {}),
        ...(input.descriptionKm ? { descriptionKm: input.descriptionKm } : {}),
        ...(input.descriptionEn ? { descriptionEn: input.descriptionEn } : {}),
        propertyType: input.propertyType,
        monthlyPrice: input.monthlyPrice,
        currency: input.currency,
        ...(input.depositAmount !== undefined
          ? { depositAmount: input.depositAmount }
          : {}),
        ...(input.utilityNotesKm
          ? { utilityNotesKm: input.utilityNotesKm }
          : {}),
        ...(input.utilityNotesEn
          ? { utilityNotesEn: input.utilityNotesEn }
          : {}),
        ...(input.houseRulesKm ? { houseRulesKm: input.houseRulesKm } : {}),
        ...(input.houseRulesEn ? { houseRulesEn: input.houseRulesEn } : {}),
        ...(input.bedrooms !== undefined ? { bedrooms: input.bedrooms } : {}),
        ...(input.bathrooms !== undefined
          ? { bathrooms: input.bathrooms }
          : {}),
        ...(input.furnished !== undefined
          ? { furnished: input.furnished }
          : {}),
        ...(input.availableFrom
          ? { availableFrom: parseDateOnly(input.availableFrom) }
          : {}),
        availableUnits: input.availableUnits,
        contactPreference: input.contactPreference,
      },
      amenityIds,
    };

    return toLandlordListingDto(await this.repository.create(createInput));
  }

  async listOwned(
    landlordId: string,
    query: ListLandlordListingsDto,
  ): Promise<{
    data: LandlordListingDto[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const result = await this.repository.listOwned(landlordId, {
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {}),
    });
    return {
      data: result.records.map(toLandlordListingDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  async getOwned(
    landlordId: string,
    listingId: string,
  ): Promise<LandlordListingDto> {
    return toLandlordListingDto(await this.requireOwned(listingId, landlordId));
  }

  async update(
    landlordId: string,
    listingId: string,
    input: UpdateListingDto,
  ): Promise<LandlordListingDto> {
    assertNoNullValues(input);
    if (!hasUpdateFields(input)) {
      throw new BadRequestException({
        code: "LISTING_UPDATE_EMPTY",
        message: "Provide at least one listing or property field to update.",
      });
    }

    const current = await this.requireOwned(listingId, landlordId);
    if (!canEditListing(current.status)) {
      throw invalidState(current.status, "EDIT");
    }
    if (
      input.property?.totalUnits !== undefined &&
      input.property.totalUnits < current.availableUnits
    ) {
      throw new BadRequestException({
        code: "PROPERTY_CAPACITY_TOO_LOW",
        message:
          "Total rooms cannot be lower than the listing's available rooms.",
        fields: [
          {
            field: "property.totalUnits",
            message: `Enter at least ${current.availableUnits}.`,
          },
        ],
      });
    }

    if (input.amenityIds) await this.assertActiveAmenities(input.amenityIds);
    if (input.contactPreference) {
      await this.assertContactPreference(landlordId, input.contactPreference);
    }
    const updateInput = toUpdateInput(input);
    const updated = await this.repository.updateOwned(
      listingId,
      landlordId,
      current.property.id,
      current.status,
      updateInput,
    );
    if (!updated) throw concurrentChange();
    return toLandlordListingDto(updated);
  }

  async updateAvailability(
    landlordId: string,
    listingId: string,
    input: UpdateAvailabilityDto,
  ): Promise<LandlordListingDto> {
    const current = await this.requireOwned(listingId, landlordId);
    if (!canUpdateAvailability(current.status)) {
      throw invalidState(current.status, "UPDATE_AVAILABILITY");
    }
    requireAvailableCapacity(input.availableUnits, current.property.totalUnits);
    if (input.availableUnits > current.availableUnits) {
      await this.entitlements.assertRestrictedSupplyActionAllowed(
        landlordId,
        "INCREASE_AVAILABILITY",
      );
    }

    const updated = await this.repository.updateAvailability(
      listingId,
      landlordId,
      current.status,
      {
        availableUnits: input.availableUnits,
        availabilityConfirmedAt: new Date(),
        ...(current.status === ListingStatus.PUBLISHED &&
        input.availableUnits === 0
          ? { status: ListingStatus.RENTED }
          : {}),
      },
    );
    if (!updated) throw concurrentChange();
    return toLandlordListingDto(updated);
  }

  async submit(
    landlordId: string,
    listingId: string,
  ): Promise<LandlordListingDto> {
    const current = await this.requireOwned(listingId, landlordId);
    if (current.availableUnits === 0) {
      throw new ConflictException({
        code: "LISTING_AVAILABILITY_REQUIRED",
        message: "At least one room must be available before submission.",
      });
    }
    await this.entitlements.assertRestrictedSupplyActionAllowed(
      landlordId,
      "SUBMIT_LISTING",
    );
    return this.transition(current, landlordId, "SUBMIT", {
      availabilityConfirmedAt: new Date(),
      publishedAt: null,
      moderationNote: null,
    });
  }

  async pause(
    landlordId: string,
    listingId: string,
  ): Promise<LandlordListingDto> {
    const current = await this.requireOwned(listingId, landlordId);
    return this.transition(current, landlordId, "PAUSE", {});
  }

  async markRented(
    landlordId: string,
    listingId: string,
  ): Promise<LandlordListingDto> {
    const current = await this.requireOwned(listingId, landlordId);
    return this.transition(current, landlordId, "MARK_RENTED", {
      availableUnits: 0,
      availabilityConfirmedAt: new Date(),
    });
  }

  async archive(
    landlordId: string,
    listingId: string,
  ): Promise<LandlordListingDto> {
    const current = await this.requireOwned(listingId, landlordId);
    return this.transition(current, landlordId, "ARCHIVE", {});
  }

  private async transition(
    current: LandlordListingRecord,
    landlordId: string,
    action: LandlordListingAction,
    extra: {
      availableUnits?: number;
      availabilityConfirmedAt?: Date;
      publishedAt?: null;
      moderationNote?: null;
    },
  ): Promise<LandlordListingDto> {
    const status = nextListingStatus(current.status, action);
    if (!status) throw invalidState(current.status, action);
    const updated = await this.repository.transition(
      current.id,
      landlordId,
      current.status,
      { status, ...extra },
    );
    if (!updated) throw concurrentChange();
    return toLandlordListingDto(updated);
  }

  private async requireOwned(
    listingId: string,
    landlordId: string,
  ): Promise<LandlordListingRecord> {
    const listing = await this.repository.findOwned(listingId, landlordId);
    if (!listing) throw listingNotFound();
    return listing;
  }

  private async assertActiveAmenities(amenityIds: string[]): Promise<void> {
    const active = await this.repository.findActiveAmenityIds(amenityIds);
    if (active.length === new Set(amenityIds).size) return;
    throw new BadRequestException({
      code: "AMENITIES_INVALID",
      message: "Every amenity must exist and be active.",
      fields: [
        {
          field: "amenityIds",
          message: "Remove unknown or inactive amenity identifiers.",
        },
      ],
    });
  }

  private async assertContactPreference(
    landlordId: string,
    preference: ContactPreference,
  ): Promise<void> {
    const channels =
      await this.repository.findLandlordContactChannels(landlordId);
    if (!channels) {
      throw new ConflictException({
        code: "LANDLORD_ONBOARDING_REQUIRED",
        message:
          "Complete the landlord profile before configuring listing contact options.",
      });
    }
    const phoneRequired =
      preference === ContactPreference.PHONE ||
      preference === ContactPreference.PHONE_OR_TELEGRAM;
    const telegramRequired =
      preference === ContactPreference.TELEGRAM ||
      preference === ContactPreference.PHONE_OR_TELEGRAM;
    if (
      (!phoneRequired || channels.hasPhone) &&
      (!telegramRequired || channels.hasTelegram)
    ) {
      return;
    }
    throw new BadRequestException({
      code: "CONTACT_PREFERENCE_UNAVAILABLE",
      message: "The landlord profile is missing a selected contact channel.",
      fields: [
        {
          field: "contactPreference",
          message: "Add the selected phone or Telegram contact first.",
        },
      ],
    });
  }
}

function toUpdateInput(input: UpdateListingDto): UpdateLandlordListingInput {
  const { property, amenityIds, availableFrom, ...listingFields } = input;
  return {
    ...(property ? { property: { ...property } } : {}),
    listing: {
      ...listingFields,
      ...(availableFrom ? { availableFrom: parseDateOnly(availableFrom) } : {}),
    },
    ...(amenityIds ? { amenityIds } : {}),
  };
}

function hasUpdateFields(input: UpdateListingDto): boolean {
  return Object.entries(input).some(([key, value]) =>
    key === "property"
      ? value !== null &&
        typeof value === "object" &&
        Object.keys(value).length > 0
      : value !== undefined,
  );
}

function requireTitle(titleKm?: string, titleEn?: string): void {
  if (titleKm || titleEn) return;
  throw new BadRequestException({
    code: "LISTING_TITLE_REQUIRED",
    message: "Provide a Khmer or English listing title.",
    fields: [
      { field: "titleKm", message: "Provide at least one listing title." },
      { field: "titleEn", message: "Provide at least one listing title." },
    ],
  });
}

function assertNoNullValues(value: object, parentPath = ""): void {
  for (const [key, nested] of Object.entries(value)) {
    const path = parentPath ? `${parentPath}.${key}` : key;
    if (nested === null) {
      throw new BadRequestException({
        code: "LISTING_NULL_FIELD_INVALID",
        message: "Use a valid value or omit optional listing fields.",
        fields: [{ field: path, message: "Null is not accepted." }],
      });
    }
    if (
      typeof nested === "object" &&
      !Array.isArray(nested) &&
      !(nested instanceof Date)
    ) {
      assertNoNullValues(nested, path);
    }
  }
}

function requireAvailableCapacity(
  availableUnits: number,
  totalUnits: number,
): void {
  if (availableUnits <= totalUnits) return;
  throw new BadRequestException({
    code: "AVAILABLE_UNITS_EXCEED_TOTAL",
    message: "Available rooms cannot exceed total rooms.",
    fields: [
      {
        field: "availableUnits",
        message: `Enter ${totalUnits} or fewer available rooms.`,
      },
    ],
  });
}

function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException({
      code: "AVAILABLE_FROM_INVALID",
      message: "Available-from date must be a real calendar date.",
      fields: [
        { field: "availableFrom", message: "Enter a valid YYYY-MM-DD date." },
      ],
    });
  }
  return date;
}

function createSlug(value: string): string {
  const base = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 130);
  return `${base || "rental"}-${randomUUID()}`;
}

function listingNotFound(): NotFoundException {
  return new NotFoundException({
    code: "LISTING_NOT_FOUND",
    message: "The rental listing could not be found.",
  });
}

function invalidState(
  status: ListingStatus,
  action: LandlordListingAction | "EDIT" | "UPDATE_AVAILABILITY",
): ConflictException {
  return new ConflictException({
    code: "LISTING_STATE_TRANSITION_INVALID",
    message: `A ${status} listing cannot perform ${action}.`,
  });
}

function concurrentChange(): ConflictException {
  return new ConflictException({
    code: "LISTING_CHANGED",
    message: "The listing changed during this request. Reload and try again.",
  });
}

export function toLandlordListingDto(
  listing: LandlordListingRecord,
): LandlordListingDto {
  return {
    id: listing.id,
    slug: listing.slug,
    titleKm: listing.titleKm,
    titleEn: listing.titleEn,
    descriptionKm: listing.descriptionKm,
    descriptionEn: listing.descriptionEn,
    propertyType: listing.propertyType,
    monthlyPrice: Number(listing.monthlyPrice.toString()),
    currency: listing.currency,
    depositAmount: listing.depositAmount
      ? Number(listing.depositAmount.toString())
      : null,
    utilityNotesKm: listing.utilityNotesKm,
    utilityNotesEn: listing.utilityNotesEn,
    houseRulesKm: listing.houseRulesKm,
    houseRulesEn: listing.houseRulesEn,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    furnished: listing.furnished,
    availableFrom: listing.availableFrom?.toISOString().slice(0, 10) ?? null,
    availableUnits: listing.availableUnits,
    availabilityConfirmedAt:
      listing.availabilityConfirmedAt?.toISOString() ?? null,
    contactPreference: listing.contactPreference,
    status: listing.status,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    property: {
      id: listing.property.id,
      name: listing.property.name,
      addressLine: listing.property.addressLine,
      commune: listing.property.commune,
      district: listing.property.district,
      city: listing.property.city,
      countryCode: listing.property.countryCode,
      latitude: Number(listing.property.latitude.toString()),
      longitude: Number(listing.property.longitude.toString()),
      googlePlaceId: listing.property.googlePlaceId,
      totalUnits: listing.property.totalUnits,
    },
    amenities: listing.amenities
      .map(({ amenity }) => amenity)
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.key.localeCompare(right.key),
      )
      .map(({ sortOrder: _sortOrder, ...amenity }) => amenity),
  };
}
