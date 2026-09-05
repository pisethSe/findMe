import type {
  Currency,
  InstitutionDto,
  InstitutionSearchPage,
  PropertyType,
  PublicListingDto,
  PublicListingSearchMeta,
  PublicListingSearchPage,
  PublicListingSort,
  SearchViewport,
} from "@findme/contracts";

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export class PublicSearchApiError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "PublicSearchApiError";
    this.code = code;
  }
}

export async function searchInstitutions(
  input: { query?: string; slug?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<InstitutionSearchPage> {
  const query = new URLSearchParams();
  if (input.query?.trim()) query.set("query", input.query.trim());
  if (input.slug) query.set("slug", input.slug);
  query.set("limit", String(input.limit ?? 20));
  const response = await fetch(`${apiBaseUrl()}/institutions?${query}`, {
    method: "GET",
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw publicApiError(payload);
  if (!isInstitutionSearchPage(payload)) {
    throw new PublicSearchApiError(
      "FindMe received an invalid institution response.",
      "PUBLIC_SEARCH_RESPONSE_INVALID",
    );
  }
  return payload;
}

export async function findInstitutionBySlug(
  slug: string,
  signal?: AbortSignal,
): Promise<InstitutionDto | null> {
  const page = await searchInstitutions({ slug, limit: 1 }, signal);
  return page.data[0] ?? null;
}

export async function searchPublishedListings(
  input: {
    institutionId: string;
    radiusMeters: number;
    minPrice?: number;
    maxPrice?: number;
    currency?: Currency;
    propertyType?: PropertyType;
    propertyTypes?: readonly PropertyType[];
    amenities?: readonly string[];
    availableBy?: string;
    viewport?: SearchViewport;
    sort?: PublicListingSort;
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal,
): Promise<PublicListingSearchPage> {
  const query = new URLSearchParams({
    institutionId: input.institutionId,
    radiusMeters: String(input.radiusMeters),
    sort: input.sort ?? "distance",
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 50),
  });
  if (input.minPrice !== undefined) {
    query.set("minPrice", String(input.minPrice));
  }
  if (input.maxPrice !== undefined) {
    query.set("maxPrice", String(input.maxPrice));
  }
  if (input.currency) query.set("currency", input.currency);
  if (input.propertyType) query.set("propertyType", input.propertyType);
  if (input.propertyTypes?.length) {
    query.set("propertyTypes", input.propertyTypes.join(","));
  }
  if (input.amenities?.length) {
    query.set("amenities", input.amenities.join(","));
  }
  if (input.availableBy) query.set("availableBy", input.availableBy);
  if (input.viewport) {
    query.set("north", String(input.viewport.north));
    query.set("south", String(input.viewport.south));
    query.set("east", String(input.viewport.east));
    query.set("west", String(input.viewport.west));
  }

  const response = await fetch(`${apiBaseUrl()}/listings/search?${query}`, {
    method: "GET",
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw publicApiError(payload);
  if (!isPublicListingSearchPage(payload)) {
    throw new PublicSearchApiError(
      "FindMe received an invalid rental-search response.",
      "PUBLIC_SEARCH_RESPONSE_INVALID",
    );
  }
  return payload;
}

function publicApiError(payload: unknown): PublicSearchApiError {
  const error =
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null
      ? (payload.error as ErrorEnvelope["error"])
      : undefined;
  return new PublicSearchApiError(
    error?.message ?? "FindMe could not load current rentals.",
    error?.code ?? "PUBLIC_SEARCH_FAILED",
  );
}

function isInstitutionSearchPage(
  payload: unknown,
): payload is InstitutionSearchPage {
  if (typeof payload !== "object" || payload === null) return false;
  const page = payload as Partial<InstitutionSearchPage>;
  return (
    Array.isArray(page.data) &&
    page.data.every(isInstitution) &&
    typeof page.meta === "object" &&
    page.meta !== null &&
    Number.isInteger(page.meta.count) &&
    page.meta.count === page.data.length &&
    (page.meta.query === null || typeof page.meta.query === "string") &&
    (page.meta.selectedSlug === null ||
      typeof page.meta.selectedSlug === "string") &&
    Number.isInteger(page.meta.limit) &&
    page.meta.limit >= 1 &&
    page.meta.limit <= 50
  );
}

function isInstitution(value: unknown): value is InstitutionDto {
  if (typeof value !== "object" || value === null) return false;
  const institution = value as Partial<InstitutionDto>;
  return (
    typeof institution.id === "string" &&
    typeof institution.slug === "string" &&
    typeof institution.nameKm === "string" &&
    typeof institution.nameEn === "string" &&
    (institution.shortName === null ||
      typeof institution.shortName === "string") &&
    ["UNIVERSITY", "COLLEGE", "SCHOOL", "OTHER"].includes(
      institution.type ?? "",
    ) &&
    typeof institution.city === "string" &&
    typeof institution.latitude === "number" &&
    Number.isFinite(institution.latitude) &&
    institution.latitude >= -90 &&
    institution.latitude <= 90 &&
    typeof institution.longitude === "number" &&
    Number.isFinite(institution.longitude) &&
    institution.longitude >= -180 &&
    institution.longitude <= 180
  );
}

function isPublicListingSearchPage(
  payload: unknown,
): payload is PublicListingSearchPage {
  if (typeof payload !== "object" || payload === null) return false;
  const page = payload as Partial<PublicListingSearchPage>;
  return (
    Array.isArray(page.data) &&
    page.data.every(isPublicListing) &&
    isPublicListingSearchMeta(page.meta)
  );
}

function isPublicListing(value: unknown): value is PublicListingDto {
  if (typeof value !== "object" || value === null) return false;
  const listing = value as Partial<PublicListingDto>;
  return (
    typeof listing.id === "string" &&
    typeof listing.slug === "string" &&
    (listing.titleKm === null || typeof listing.titleKm === "string") &&
    (listing.titleEn === null || typeof listing.titleEn === "string") &&
    isPropertyType(listing.propertyType) &&
    typeof listing.monthlyPrice === "number" &&
    Number.isFinite(listing.monthlyPrice) &&
    listing.monthlyPrice >= 0 &&
    (listing.currency === "USD" || listing.currency === "KHR") &&
    typeof listing.availableUnits === "number" &&
    Number.isInteger(listing.availableUnits) &&
    listing.availableUnits > 0 &&
    (listing.availableFrom === null || isDateOnly(listing.availableFrom)) &&
    isTimestamp(listing.availabilityConfirmedAt) &&
    isTimestamp(listing.publishedAt) &&
    typeof listing.distanceMeters === "number" &&
    Number.isFinite(listing.distanceMeters) &&
    listing.distanceMeters >= 0 &&
    isPublicLocation(listing.location) &&
    Array.isArray(listing.amenities) &&
    listing.amenities.every(isAmenity) &&
    (listing.primaryImage === null || isPrimaryImage(listing.primaryImage))
  );
}

function isPublicListingSearchMeta(
  value: unknown,
): value is PublicListingSearchMeta {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as Partial<PublicListingSearchMeta>;
  return (
    typeof meta.page === "number" &&
    Number.isInteger(meta.page) &&
    meta.page >= 1 &&
    typeof meta.pageSize === "number" &&
    Number.isInteger(meta.pageSize) &&
    meta.pageSize >= 1 &&
    meta.pageSize <= 50 &&
    typeof meta.total === "number" &&
    Number.isInteger(meta.total) &&
    meta.total >= 0 &&
    typeof meta.totalPages === "number" &&
    Number.isInteger(meta.totalPages) &&
    meta.totalPages >= 0 &&
    isInstitution(meta.institution) &&
    typeof meta.radiusMeters === "number" &&
    Number.isFinite(meta.radiusMeters) &&
    meta.radiusMeters >= 100 &&
    meta.radiusMeters <= 20_000 &&
    (meta.viewport === null || isViewport(meta.viewport)) &&
    isAppliedFilters(meta.filters) &&
    ["distance", "price_asc", "price_desc", "newest"].includes(
      meta.sort ?? "",
    ) &&
    isTimestamp(meta.refreshedAt) &&
    (meta.cacheGeneration === null || typeof meta.cacheGeneration === "string")
  );
}

function isAppliedFilters(
  value: unknown,
): value is PublicListingSearchMeta["filters"] {
  if (typeof value !== "object" || value === null) return false;
  const filters = value as Partial<PublicListingSearchMeta["filters"]>;
  return (
    (filters.minPrice === null ||
      (typeof filters.minPrice === "number" &&
        Number.isFinite(filters.minPrice) &&
        filters.minPrice >= 0)) &&
    (filters.maxPrice === null ||
      (typeof filters.maxPrice === "number" &&
        Number.isFinite(filters.maxPrice) &&
        filters.maxPrice >= 0)) &&
    (filters.currency === null ||
      filters.currency === "USD" ||
      filters.currency === "KHR") &&
    Array.isArray(filters.propertyTypes) &&
    filters.propertyTypes.every(isPropertyType) &&
    Array.isArray(filters.amenities) &&
    filters.amenities.every((amenity) => typeof amenity === "string") &&
    isDateOnly(filters.availableBy)
  );
}

function isViewport(value: unknown): value is SearchViewport {
  if (typeof value !== "object" || value === null) return false;
  const viewport = value as Partial<SearchViewport>;
  return (
    typeof viewport.north === "number" &&
    Number.isFinite(viewport.north) &&
    viewport.north >= -90 &&
    viewport.north <= 90 &&
    typeof viewport.south === "number" &&
    Number.isFinite(viewport.south) &&
    viewport.south >= -90 &&
    viewport.south <= 90 &&
    typeof viewport.east === "number" &&
    Number.isFinite(viewport.east) &&
    viewport.east >= -180 &&
    viewport.east <= 180 &&
    typeof viewport.west === "number" &&
    Number.isFinite(viewport.west) &&
    viewport.west >= -180 &&
    viewport.west <= 180 &&
    viewport.north > viewport.south &&
    viewport.east > viewport.west
  );
}

function isPublicLocation(
  value: unknown,
): value is PublicListingDto["location"] {
  if (typeof value !== "object" || value === null) return false;
  const location = value as Partial<PublicListingDto["location"]>;
  return (
    (location.commune === null || typeof location.commune === "string") &&
    (location.district === null || typeof location.district === "string") &&
    typeof location.city === "string" &&
    typeof location.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

function isAmenity(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const amenity = value as Record<string, unknown>;
  return (
    typeof amenity.id === "string" &&
    typeof amenity.key === "string" &&
    typeof amenity.nameKm === "string" &&
    typeof amenity.nameEn === "string" &&
    (amenity.category === null || typeof amenity.category === "string")
  );
}

function isPrimaryImage(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const image = value as Record<string, unknown>;
  return (
    typeof image.id === "string" &&
    typeof image.publicUrl === "string" &&
    (image.altTextKm === null || typeof image.altTextKm === "string") &&
    (image.altTextEn === null || typeof image.altTextEn === "string") &&
    (image.width === null ||
      (Number.isInteger(image.width) && Number(image.width) > 0)) &&
    (image.height === null ||
      (Number.isInteger(image.height) && Number(image.height) > 0)) &&
    Number.isInteger(image.sortOrder) &&
    Number(image.sortOrder) >= 0
  );
}

function isPropertyType(value: unknown): value is PropertyType {
  return [
    "ROOM",
    "STUDIO",
    "APARTMENT",
    "HOUSE",
    "DORM_ROOM",
    "OTHER_STUDENT_RENTAL",
  ].includes(typeof value === "string" ? value : "");
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function apiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:3001/api/v1"
  );
}
