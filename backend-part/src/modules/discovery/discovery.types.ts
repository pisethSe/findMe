import type {
  Currency,
  InstitutionType,
  PropertyType,
} from "../../generated/prisma/client.js";
import type { PublicListingSort } from "./dto/search-public-listings.dto.js";

export interface SearchViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface NormalizedPublicSearchInput {
  institutionId: string;
  radiusMeters: number;
  minPrice?: number;
  maxPrice?: number;
  currency?: Currency;
  propertyTypes: PropertyType[];
  amenities: string[];
  availableBy: string;
  viewport: SearchViewport | null;
  sort: PublicListingSort;
  page: number;
  pageSize: number;
}

export interface InstitutionRecord {
  id: string;
  slug: string;
  nameKm: string;
  nameEn: string;
  shortName: string | null;
  type: InstitutionType;
  city: string;
  latitude: { toString(): string };
  longitude: { toString(): string };
}

export interface PublicSearchRecord {
  id: string;
  slug: string;
  titleKm: string | null;
  titleEn: string | null;
  propertyType: PropertyType;
  monthlyPrice: number;
  currency: Currency;
  availableUnits: number;
  availableFrom: string | null;
  availabilityConfirmedAt: Date;
  publishedAt: Date;
  commune: string | null;
  district: string | null;
  city: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  amenities: Array<{
    id: string;
    key: string;
    nameKm: string;
    nameEn: string;
    category: string | null;
  }> | null;
  primaryImageId: string | null;
  primaryImageUrl: string | null;
  primaryImageAltKm: string | null;
  primaryImageAltEn: string | null;
  primaryImageWidth: number | null;
  primaryImageHeight: number | null;
  primaryImageSortOrder: number | null;
}
