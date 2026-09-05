import type {
  AmenityDto,
  ContactPreference,
  Currency,
  LandlordListingDto,
  ListingImageDto,
  PropertyType,
} from "@findme/contracts";

import { AuthApiError, authorizedRequest } from "../auth/auth-api";

export interface CreateLandlordListingInput {
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
  availableFrom?: string;
  availableUnits: number;
  contactPreference: ContactPreference;
  amenityIds?: string[];
}

export interface UpdateLandlordListingInput {
  property: {
    name: string;
    addressLine: string;
    commune: string | null;
    district: string | null;
    city: string;
    countryCode: "KH";
    latitude: number;
    longitude: number;
    googlePlaceId: string | null;
    totalUnits: number;
  };
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
  contactPreference: ContactPreference;
  amenityIds: string[];
}

interface UploadIntent {
  media: ListingImageDto;
  upload: {
    url: string;
    method: "PUT";
    headers: { "content-type": string };
    expiresAt: string;
    maxBytes: number;
  };
}

export function listAmenities(): Promise<AmenityDto[]> {
  return authorizedRequest<AmenityDto[]>("/amenities", { method: "GET" });
}

export function createLandlordListing(
  input: CreateLandlordListingInput,
): Promise<LandlordListingDto> {
  return authorizedRequest<LandlordListingDto>("/landlord/listings", {
    method: "POST",
    body: input,
  });
}

export function getLandlordListing(
  listingId: string,
): Promise<LandlordListingDto> {
  return authorizedRequest<LandlordListingDto>(
    `/landlord/listings/${listingId}`,
    { method: "GET" },
  );
}

export function updateLandlordListing(
  listingId: string,
  input: UpdateLandlordListingInput,
): Promise<LandlordListingDto> {
  return authorizedRequest<LandlordListingDto>(
    `/landlord/listings/${listingId}`,
    { method: "PATCH", body: input },
  );
}

export function submitLandlordListing(
  listingId: string,
): Promise<LandlordListingDto> {
  return authorizedRequest<LandlordListingDto>(
    `/landlord/listings/${listingId}/submit`,
    { method: "POST", body: {} },
  );
}

export async function uploadListingPhoto(input: {
  listingId: string;
  file: File;
  sortOrder: number;
  altTextKm?: string;
  altTextEn?: string;
}): Promise<ListingImageDto> {
  const intent = await authorizedRequest<UploadIntent>(
    "/media/upload-intents",
    {
      method: "POST",
      body: {
        listingId: input.listingId,
        contentType: input.file.type,
        sizeBytes: input.file.size,
        sortOrder: input.sortOrder,
      },
    },
  );

  const upload = await fetch(intent.upload.url, {
    method: intent.upload.method,
    headers: intent.upload.headers,
    body: input.file,
  });
  if (!upload.ok) {
    let cleanupFailed = false;
    try {
      await authorizedRequest(`/media/${intent.media.id}`, {
        method: "DELETE",
      });
    } catch {
      cleanupFailed = true;
    }
    throw new AuthApiError(
      cleanupFailed
        ? "The photo upload failed and its pending upload could not be cleared. Try again."
        : "The photo upload failed. Try again.",
      "MEDIA_UPLOAD_FAILED",
      [],
    );
  }

  return authorizedRequest<ListingImageDto>(
    `/media/${intent.media.id}/finalize`,
    {
      method: "POST",
      body: {
        ...(input.altTextKm ? { altTextKm: input.altTextKm } : {}),
        ...(input.altTextEn ? { altTextEn: input.altTextEn } : {}),
      },
    },
  );
}
