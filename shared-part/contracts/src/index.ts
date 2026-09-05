export interface ApiSuccess<TData> {
  data: TData;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
    fields: readonly ApiFieldError[] | null;
  };
}

export interface CursorMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CursorPage<TData> {
  data: readonly TData[];
  meta: CursorMeta;
}

export interface OffsetPageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type UserRole = "STUDENT" | "LANDLORD" | "ADMIN";
export type PreferredLocale = "KM" | "EN";
export type PropertyType =
  | "ROOM"
  | "STUDIO"
  | "APARTMENT"
  | "HOUSE"
  | "DORM_ROOM"
  | "OTHER_STUDENT_RENTAL";
export type Currency = "USD" | "KHR";
export type PublicListingSort =
  "distance" | "price_asc" | "price_desc" | "newest";
export type ListingStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "PAUSED"
  | "RENTED"
  | "REJECTED"
  | "ARCHIVED";
export type ContactPreference =
  "IN_APP_ONLY" | "PHONE" | "TELEGRAM" | "PHONE_OR_TELEGRAM";
export type ListingImageStatus = "UPLOADING" | "READY" | "FAILED" | "REMOVED";
export type InquiryStatus = "NEW" | "READ" | "RESPONDED" | "CLOSED";

export interface AmenityDto {
  id: string;
  key: string;
  nameKm: string;
  nameEn: string;
  category: string | null;
}

export interface ListingImageDto {
  id: string;
  listingId?: string;
  publicUrl: string;
  altTextKm: string | null;
  altTextEn: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  status: ListingImageStatus;
}

export interface LandlordListingDto {
  id: string;
  slug: string;
  titleKm: string | null;
  titleEn: string | null;
  descriptionKm: string | null;
  descriptionEn: string | null;
  propertyType: PropertyType;
  monthlyPrice: number;
  currency: Currency;
  depositAmount: number | null;
  utilityNotesKm: string | null;
  utilityNotesEn: string | null;
  houseRulesKm: string | null;
  houseRulesEn: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: boolean;
  availableFrom: string | null;
  availableUnits: number;
  availabilityConfirmedAt: string | null;
  contactPreference: ContactPreference;
  status: ListingStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  property: {
    id: string;
    name: string;
    addressLine: string;
    commune: string | null;
    district: string | null;
    city: string;
    countryCode: string;
    latitude: number;
    longitude: number;
    googlePlaceId: string | null;
    totalUnits: number;
  };
  amenities: ReadonlyArray<{
    id: string;
    key: string;
    nameKm: string;
    nameEn: string;
    category: string | null;
  }>;
  images: readonly ListingImageDto[];
}

export interface LandlordListingPage {
  data: readonly LandlordListingDto[];
  meta: OffsetPageMeta;
}

export interface LandlordInquiryDto {
  id: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
  student: {
    displayName: string;
  };
  listing: {
    id: string;
    titleKm: string | null;
    titleEn: string | null;
    propertyName: string;
  };
}

export interface LandlordInquiryPage {
  data: readonly LandlordInquiryDto[];
  meta: OffsetPageMeta;
}

export interface InstitutionDto {
  id: string;
  slug: string;
  nameKm: string;
  nameEn: string;
  shortName: string | null;
  type: "UNIVERSITY" | "COLLEGE" | "SCHOOL" | "OTHER";
  city: string;
  latitude: number;
  longitude: number;
}

export interface InstitutionSearchPage {
  data: readonly InstitutionDto[];
  meta: {
    count: number;
    query: string | null;
    selectedSlug: string | null;
    limit: number;
  };
}

export interface PublicListingDto {
  id: string;
  slug: string;
  titleKm: string | null;
  titleEn: string | null;
  propertyType: PropertyType;
  monthlyPrice: number;
  currency: Currency;
  availableUnits: number;
  availableFrom: string | null;
  availabilityConfirmedAt: string;
  publishedAt: string;
  distanceMeters: number;
  location: {
    commune: string | null;
    district: string | null;
    city: string;
    latitude: number;
    longitude: number;
  };
  amenities: readonly AmenityDto[];
  primaryImage: Omit<ListingImageDto, "listingId" | "status"> | null;
}

export interface SearchViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface PublicListingSearchMeta extends OffsetPageMeta {
  institution: InstitutionDto;
  radiusMeters: number;
  viewport: SearchViewport | null;
  filters: {
    minPrice: number | null;
    maxPrice: number | null;
    currency: Currency | null;
    propertyTypes: readonly PropertyType[];
    amenities: readonly string[];
    availableBy: string;
  };
  sort: PublicListingSort;
  refreshedAt: string;
  cacheGeneration: string | null;
}

export interface PublicListingSearchPage {
  data: readonly PublicListingDto[];
  meta: PublicListingSearchMeta;
}

export interface AdminPendingListingDto extends LandlordListingDto {
  moderationNote: string | null;
  landlord: {
    displayName: string;
    businessName: string | null;
    verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  };
}

export interface AuthUserDto {
  id: string;
  email: string | null;
  role: UserRole | null;
  preferredLocale: PreferredLocale;
  onboardingComplete: boolean;
}

export interface AuthSessionDto {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  user: AuthUserDto;
}

export interface PasswordResetRequestedDto {
  accepted: true;
  /** Returned only by local/test environments; never returned in staging/production. */
  developmentResetToken?: string;
}
