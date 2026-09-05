import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";
import type { ListingStatus } from "../../generated/prisma/client.js";
import type {
  CreateLandlordListingInput,
  LandlordListingRecord,
  UpdateLandlordListingInput,
} from "./listings.types.js";

export const landlordListingSelect = {
  id: true,
  slug: true,
  titleKm: true,
  titleEn: true,
  descriptionKm: true,
  descriptionEn: true,
  propertyType: true,
  monthlyPrice: true,
  currency: true,
  depositAmount: true,
  utilityNotesKm: true,
  utilityNotesEn: true,
  houseRulesKm: true,
  houseRulesEn: true,
  bedrooms: true,
  bathrooms: true,
  furnished: true,
  availableFrom: true,
  availableUnits: true,
  availabilityConfirmedAt: true,
  contactPreference: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  property: {
    select: {
      id: true,
      name: true,
      addressLine: true,
      commune: true,
      district: true,
      city: true,
      countryCode: true,
      latitude: true,
      longitude: true,
      googlePlaceId: true,
      totalUnits: true,
    },
  },
  amenities: {
    select: {
      amenity: {
        select: {
          id: true,
          key: true,
          nameKm: true,
          nameEn: true,
          category: true,
          sortOrder: true,
        },
      },
    },
  },
  images: {
    select: {
      id: true,
      publicUrl: true,
      altTextKm: true,
      altTextEn: true,
      width: true,
      height: true,
      sortOrder: true,
      status: true,
    },
    orderBy: { sortOrder: "asc" },
  },
} as const;

@Injectable()
export class ListingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOwned(
    listingId: string,
    landlordId: string,
  ): Promise<LandlordListingRecord | null> {
    return this.prisma.listing.findFirst({
      where: { id: listingId, landlordId, deletedAt: null },
      select: landlordListingSelect,
    });
  }

  async listOwned(
    landlordId: string,
    input: { page: number; pageSize: number; status?: ListingStatus },
  ): Promise<{ records: LandlordListingRecord[]; total: number }> {
    const where = {
      landlordId,
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        select: landlordListingSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { records, total };
  }

  async findActiveAmenityIds(amenityIds: string[]): Promise<string[]> {
    if (amenityIds.length === 0) return [];
    const amenities = await this.prisma.amenity.findMany({
      where: { id: { in: amenityIds }, isActive: true },
      select: { id: true },
    });
    return amenities.map(({ id }) => id);
  }

  async findLandlordContactChannels(
    landlordId: string,
  ): Promise<{ hasPhone: boolean; hasTelegram: boolean } | null> {
    const profile = await this.prisma.landlordProfile.findUnique({
      where: { userId: landlordId },
      select: { contactPhone: true, contactTelegram: true },
    });
    return profile
      ? {
          hasPhone: profile.contactPhone.trim().length > 0,
          hasTelegram: Boolean(profile.contactTelegram?.trim()),
        }
      : null;
  }

  async create(
    input: CreateLandlordListingInput,
  ): Promise<LandlordListingRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const property = await transaction.property.create({
        data: {
          landlordId: input.landlordId,
          name: input.property.name,
          addressLine: input.property.addressLine,
          ...(input.property.commune
            ? { commune: input.property.commune }
            : {}),
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
        select: { id: true },
      });

      return transaction.listing.create({
        data: {
          propertyId: property.id,
          landlordId: input.landlordId,
          slug: input.slug,
          ...input.listing,
          ...(input.amenityIds.length > 0
            ? {
                amenities: {
                  createMany: {
                    data: input.amenityIds.map((amenityId) => ({ amenityId })),
                  },
                },
              }
            : {}),
        },
        select: landlordListingSelect,
      });
    });
  }

  async updateOwned(
    listingId: string,
    landlordId: string,
    propertyId: string,
    expectedStatus: ListingStatus,
    input: UpdateLandlordListingInput,
  ): Promise<LandlordListingRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.listing.updateMany({
        where: {
          id: listingId,
          landlordId,
          status: expectedStatus,
          deletedAt: null,
        },
        data:
          Object.keys(input.listing).length > 0
            ? input.listing
            : { updatedAt: new Date() },
      });
      if (updated.count !== 1) return null;

      if (input.property && Object.keys(input.property).length > 0) {
        await transaction.property.updateMany({
          where: { id: propertyId, landlordId, deletedAt: null },
          data: input.property,
        });
      }
      if (input.amenityIds) {
        await transaction.listingAmenity.deleteMany({
          where: { listingId },
        });
        if (input.amenityIds.length > 0) {
          await transaction.listingAmenity.createMany({
            data: input.amenityIds.map((amenityId) => ({
              listingId,
              amenityId,
            })),
          });
        }
      }
      return transaction.listing.findFirst({
        where: { id: listingId, landlordId, deletedAt: null },
        select: landlordListingSelect,
      });
    });
  }

  async updateAvailability(
    listingId: string,
    landlordId: string,
    expectedStatus: ListingStatus,
    input: {
      availableUnits: number;
      availabilityConfirmedAt: Date;
      status?: ListingStatus;
    },
  ): Promise<LandlordListingRecord | null> {
    return this.updateWithExpectedStatus(
      listingId,
      landlordId,
      expectedStatus,
      input,
    );
  }

  async transition(
    listingId: string,
    landlordId: string,
    expectedStatus: ListingStatus,
    data: {
      status: ListingStatus;
      availableUnits?: number;
      availabilityConfirmedAt?: Date;
      publishedAt?: Date | null;
      moderationNote?: null;
    },
  ): Promise<LandlordListingRecord | null> {
    return this.updateWithExpectedStatus(
      listingId,
      landlordId,
      expectedStatus,
      data,
    );
  }

  private async updateWithExpectedStatus(
    listingId: string,
    landlordId: string,
    expectedStatus: ListingStatus,
    data: {
      status?: ListingStatus;
      availableUnits?: number;
      availabilityConfirmedAt?: Date;
      publishedAt?: Date | null;
      moderationNote?: null;
    },
  ): Promise<LandlordListingRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.listing.updateMany({
        where: {
          id: listingId,
          landlordId,
          status: expectedStatus,
          deletedAt: null,
        },
        data,
      });
      if (updated.count !== 1) return null;
      return transaction.listing.findFirst({
        where: { id: listingId, landlordId, deletedAt: null },
        select: landlordListingSelect,
      });
    });
  }
}
