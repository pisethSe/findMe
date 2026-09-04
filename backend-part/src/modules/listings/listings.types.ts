import type {
  ContactPreference,
  Currency,
  ListingStatus,
  PropertyType,
} from "../../generated/prisma/client.js";

export interface LandlordListingRecord {
  id: string;
  slug: string;
  titleKm: string | null;
  titleEn: string | null;
  descriptionKm: string | null;
  descriptionEn: string | null;
  propertyType: PropertyType;
  monthlyPrice: { toString(): string };
  currency: Currency;
  depositAmount: { toString(): string } | null;
  utilityNotesKm: string | null;
  utilityNotesEn: string | null;
  houseRulesKm: string | null;
  houseRulesEn: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: boolean;
  availableFrom: Date | null;
  availableUnits: number;
  availabilityConfirmedAt: Date | null;
  contactPreference: ContactPreference;
  status: ListingStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  property: {
    id: string;
    name: string;
    addressLine: string;
    commune: string | null;
    district: string | null;
    city: string;
    countryCode: string;
    latitude: { toString(): string };
    longitude: { toString(): string };
    googlePlaceId: string | null;
    totalUnits: number;
  };
  amenities: Array<{
    amenity: {
      id: string;
      key: string;
      nameKm: string;
      nameEn: string;
      category: string | null;
      sortOrder: number;
    };
  }>;
}

export interface CreateLandlordListingInput {
  landlordId: string;
  slug: string;
  property: {
    name: string;
    addressLine: string;
    commune?: string;
    district?: string;
    city?: string;
    countryCode?: "KH";
    latitude: number;
    longitude: number;
    googlePlaceId?: string;
    totalUnits: number;
  };
  listing: {
    titleKm?: string;
    titleEn?: string;
    descriptionKm?: string;
    descriptionEn?: string;
    propertyType: PropertyType;
    monthlyPrice: number;
    currency: Currency;
    depositAmount?: number;
    utilityNotesKm?: string;
    utilityNotesEn?: string;
    houseRulesKm?: string;
    houseRulesEn?: string;
    bedrooms?: number;
    bathrooms?: number;
    furnished?: boolean;
    availableFrom?: Date;
    availableUnits: number;
    contactPreference: ContactPreference;
  };
  amenityIds: string[];
}

export interface UpdateLandlordListingInput {
  property?: {
    name?: string;
    addressLine?: string;
    commune?: string;
    district?: string;
    city?: string;
    countryCode?: "KH";
    latitude?: number;
    longitude?: number;
    googlePlaceId?: string;
    totalUnits?: number;
  };
  listing: {
    titleKm?: string;
    titleEn?: string;
    descriptionKm?: string;
    descriptionEn?: string;
    propertyType?: PropertyType;
    monthlyPrice?: number;
    currency?: Currency;
    depositAmount?: number;
    utilityNotesKm?: string;
    utilityNotesEn?: string;
    houseRulesKm?: string;
    houseRulesEn?: string;
    bedrooms?: number;
    bathrooms?: number;
    furnished?: boolean;
    availableFrom?: Date;
    contactPreference?: ContactPreference;
  };
  amenityIds?: string[];
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
  amenities: Array<{
    id: string;
    key: string;
    nameKm: string;
    nameEn: string;
    category: string | null;
  }>;
}
