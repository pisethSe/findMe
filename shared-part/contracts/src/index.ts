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
}

export interface LandlordListingPage {
  data: readonly LandlordListingDto[];
  meta: OffsetPageMeta;
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
