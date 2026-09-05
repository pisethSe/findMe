import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PublicCacheService } from "../public-cache/public-cache.service.js";
import type { SearchInstitutionsDto } from "./dto/search-institutions.dto.js";
import {
  PublicListingSort,
  type SearchPublicListingsDto,
} from "./dto/search-public-listings.dto.js";
import { DiscoveryRepository } from "./discovery.repository.js";
import type {
  InstitutionRecord,
  NormalizedPublicSearchInput,
  PublicSearchRecord,
  SearchViewport,
} from "./discovery.types.js";

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly repository: DiscoveryRepository,
    private readonly cache: PublicCacheService,
  ) {}

  async listInstitutions(query: SearchInstitutionsDto) {
    if (query.query && query.slug) {
      throw new BadRequestException({
        code: "INSTITUTION_SEARCH_CONFLICT",
        message: "Search by name or resolve a selected institution, not both.",
        fields: [
          {
            field: "query",
            message: "Remove either the name query or selected slug.",
          },
        ],
      });
    }

    const data = (
      await this.repository.listInstitutions({
        ...(query.query ? { q: query.query } : {}),
        ...(query.slug ? { slug: query.slug } : {}),
        limit: query.limit,
      })
    ).map(toInstitutionDto);
    return {
      data,
      meta: {
        count: data.length,
        query: query.query ?? null,
        selectedSlug: query.slug ?? null,
        limit: query.limit,
      },
    };
  }

  async search(query: SearchPublicListingsDto) {
    const normalized = normalizePublicSearchQuery(query);

    const institution = await this.repository.findInstitution(
      normalized.institutionId,
    );
    if (!institution) {
      throw new NotFoundException({
        code: "INSTITUTION_NOT_FOUND",
        message: "The selected institution could not be found.",
      });
    }

    const cached =
      await this.cache.getSearch<ReturnType<typeof buildPage>>(normalized);
    if (cached.value) {
      return {
        ...cached.value,
        meta: {
          ...cached.value.meta,
          cacheGeneration: cached.generation,
        },
      };
    }

    const result = await this.repository.search(normalized);
    const page = buildPage(result, institution, normalized, cached.generation);
    await this.cache.setSearch(cached.generation, normalized, page);
    return page;
  }
}

export function normalizePublicSearchQuery(
  query: SearchPublicListingsDto,
  now = new Date(),
): NormalizedPublicSearchInput {
  const sort = query.sort ?? PublicListingSort.DISTANCE;
  const comparesPrices =
    query.minPrice !== undefined ||
    query.maxPrice !== undefined ||
    [PublicListingSort.PRICE_ASC, PublicListingSort.PRICE_DESC].includes(sort);
  if (comparesPrices && !query.currency) {
    throw new BadRequestException({
      code: "SEARCH_CURRENCY_REQUIRED",
      message: "Choose a currency when filtering or sorting by rent.",
      fields: [
        {
          field: "currency",
          message: "Choose USD or KHR for this price comparison.",
        },
      ],
    });
  }

  if (
    query.minPrice !== undefined &&
    query.maxPrice !== undefined &&
    query.minPrice > query.maxPrice
  ) {
    throw new BadRequestException({
      code: "SEARCH_PRICE_RANGE_INVALID",
      message: "Minimum rent cannot be greater than maximum rent.",
      fields: [
        {
          field: "minPrice",
          message: "Enter a minimum rent below the maximum rent.",
        },
      ],
    });
  }

  if (query.propertyType && query.propertyTypes !== undefined) {
    throw new BadRequestException({
      code: "SEARCH_PROPERTY_TYPE_CONFLICT",
      message: "Use either propertyType or propertyTypes, not both.",
      fields: [
        {
          field: "propertyTypes",
          message: "Remove one of the property-type filters.",
        },
      ],
    });
  }

  const availableBy = query.availableBy ?? phnomPenhDate(now);
  if (!isCalendarDate(availableBy)) {
    throw new BadRequestException({
      code: "SEARCH_AVAILABLE_BY_INVALID",
      message: "Available-by date must be a real calendar date.",
      fields: [
        {
          field: "availableBy",
          message: "Enter a valid YYYY-MM-DD date.",
        },
      ],
    });
  }

  const viewport = normalizeViewport(query);
  const propertyTypes = [
    ...(query.propertyTypes ??
      (query.propertyType ? [query.propertyType] : [])),
  ].sort();
  const amenities = [...(query.amenities ?? [])].sort();

  return {
    institutionId: query.institutionId,
    radiusMeters: query.radiusMeters ?? 5_000,
    ...(query.minPrice !== undefined ? { minPrice: query.minPrice } : {}),
    ...(query.maxPrice !== undefined ? { maxPrice: query.maxPrice } : {}),
    ...(query.currency ? { currency: query.currency } : {}),
    propertyTypes,
    amenities,
    availableBy,
    viewport,
    sort,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  };
}

function normalizeViewport(
  query: SearchPublicListingsDto,
): SearchViewport | null {
  const { north, south, east, west } = query;
  const hasAnyBound = [north, south, east, west].some(
    (bound) => bound !== undefined,
  );
  if (!hasAnyBound) return null;
  if (
    north === undefined ||
    south === undefined ||
    east === undefined ||
    west === undefined
  ) {
    throw new BadRequestException({
      code: "SEARCH_VIEWPORT_INCOMPLETE",
      message: "Map bounds require north, south, east, and west together.",
      fields: [
        {
          field: "viewport",
          message: "Provide all four map bounds.",
        },
      ],
    });
  }
  if (north <= south || east <= west) {
    throw new BadRequestException({
      code: "SEARCH_VIEWPORT_INVALID",
      message: "Map bounds must define a non-empty rectangle.",
      fields: [
        {
          field: "viewport",
          message: "North must exceed south, and east must exceed west.",
        },
      ],
    });
  }
  return { north, south, east, west };
}

function isCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function phnomPenhDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new TypeError("Could not resolve the current Phnom Penh date.");
  }
  return `${year}-${month}-${day}`;
}

function buildPage(
  result: { records: PublicSearchRecord[]; total: number },
  institution: InstitutionRecord,
  query: NormalizedPublicSearchInput,
  cacheGeneration: string | null,
) {
  return {
    data: result.records.map(toPublicListingDto),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / query.pageSize),
      institution: toInstitutionDto(institution),
      radiusMeters: query.radiusMeters,
      viewport: query.viewport,
      filters: {
        minPrice: query.minPrice ?? null,
        maxPrice: query.maxPrice ?? null,
        currency: query.currency ?? null,
        propertyTypes: query.propertyTypes,
        amenities: query.amenities,
        availableBy: query.availableBy,
      },
      sort: query.sort,
      refreshedAt: new Date().toISOString(),
      cacheGeneration,
    },
  };
}

function toInstitutionDto(institution: InstitutionRecord) {
  return {
    id: institution.id,
    slug: institution.slug,
    nameKm: institution.nameKm,
    nameEn: institution.nameEn,
    shortName: institution.shortName,
    type: institution.type,
    city: institution.city,
    latitude: Number(institution.latitude.toString()),
    longitude: Number(institution.longitude.toString()),
  };
}

function toPublicListingDto(listing: PublicSearchRecord) {
  return {
    id: listing.id,
    slug: listing.slug,
    titleKm: listing.titleKm,
    titleEn: listing.titleEn,
    propertyType: listing.propertyType,
    monthlyPrice: listing.monthlyPrice,
    currency: listing.currency,
    availableUnits: listing.availableUnits,
    availableFrom: listing.availableFrom,
    availabilityConfirmedAt: listing.availabilityConfirmedAt.toISOString(),
    publishedAt: listing.publishedAt.toISOString(),
    distanceMeters: Math.round(listing.distanceMeters),
    location: {
      commune: listing.commune,
      district: listing.district,
      city: listing.city,
      latitude: listing.latitude,
      longitude: listing.longitude,
    },
    amenities: listing.amenities ?? [],
    primaryImage:
      listing.primaryImageId && listing.primaryImageUrl
        ? {
            id: listing.primaryImageId,
            publicUrl: listing.primaryImageUrl,
            altTextKm: listing.primaryImageAltKm,
            altTextEn: listing.primaryImageAltEn,
            width: listing.primaryImageWidth,
            height: listing.primaryImageHeight,
            sortOrder: listing.primaryImageSortOrder ?? 0,
          }
        : null,
  };
}
