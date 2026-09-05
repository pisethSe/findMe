import type {
  ContactPreference,
  Currency,
  LandlordListingDto,
  PropertyType,
} from "@findme/contracts";

import type {
  CreateLandlordListingInput,
  UpdateLandlordListingInput,
} from "./landlord-listing-api";

export const MAX_LISTING_PHOTOS = 12;
export const MAX_LISTING_PHOTO_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_LISTING_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ListingFormStep = 1 | 2 | 3 | 4;

export interface RentalFormValues {
  propertyName: string;
  titleKm: string;
  titleEn: string;
  propertyType: PropertyType;
  totalUnits: string;
  availableUnits: string;
  monthlyPrice: string;
  currency: Currency;
  depositAmount: string;
  descriptionKm: string;
  descriptionEn: string;
  addressLine: string;
  commune: string;
  district: string;
  latitude: string;
  longitude: string;
  googlePlaceId: string;
  utilityNotesKm: string;
  utilityNotesEn: string;
  houseRulesKm: string;
  houseRulesEn: string;
  bedrooms: string;
  bathrooms: string;
  furnished: boolean;
  availableFrom: string;
  contactPreference: ContactPreference;
  amenityIds: string[];
}

export type RentalFormErrors = Record<string, string>;

export function createInitialRentalFormValues(): RentalFormValues {
  return {
    propertyName: "",
    titleKm: "",
    titleEn: "",
    propertyType: "ROOM",
    totalUnits: "1",
    availableUnits: "1",
    monthlyPrice: "",
    currency: "USD",
    depositAmount: "",
    descriptionKm: "",
    descriptionEn: "",
    addressLine: "",
    commune: "",
    district: "",
    latitude: "",
    longitude: "",
    googlePlaceId: "",
    utilityNotesKm: "",
    utilityNotesEn: "",
    houseRulesKm: "",
    houseRulesEn: "",
    bedrooms: "",
    bathrooms: "",
    furnished: false,
    availableFrom: "",
    contactPreference: "IN_APP_ONLY",
    amenityIds: [],
  };
}

export function createRentalFormValuesFromListing(
  listing: LandlordListingDto,
): RentalFormValues {
  return {
    propertyName: listing.property.name,
    titleKm: listing.titleKm ?? "",
    titleEn: listing.titleEn ?? "",
    propertyType: listing.propertyType,
    totalUnits: String(listing.property.totalUnits),
    availableUnits: String(listing.availableUnits),
    monthlyPrice: String(listing.monthlyPrice),
    currency: listing.currency,
    depositAmount:
      listing.depositAmount === null ? "" : String(listing.depositAmount),
    descriptionKm: listing.descriptionKm ?? "",
    descriptionEn: listing.descriptionEn ?? "",
    addressLine: listing.property.addressLine,
    commune: listing.property.commune ?? "",
    district: listing.property.district ?? "",
    latitude: String(listing.property.latitude),
    longitude: String(listing.property.longitude),
    googlePlaceId: listing.property.googlePlaceId ?? "",
    utilityNotesKm: listing.utilityNotesKm ?? "",
    utilityNotesEn: listing.utilityNotesEn ?? "",
    houseRulesKm: listing.houseRulesKm ?? "",
    houseRulesEn: listing.houseRulesEn ?? "",
    bedrooms: listing.bedrooms === null ? "" : String(listing.bedrooms),
    bathrooms: listing.bathrooms === null ? "" : String(listing.bathrooms),
    furnished: listing.furnished,
    availableFrom: listing.availableFrom?.slice(0, 10) ?? "",
    contactPreference: listing.contactPreference,
    amenityIds: listing.amenities.map((amenity) => amenity.id),
  };
}

export function validateRentalStep(
  values: RentalFormValues,
  step: ListingFormStep,
): RentalFormErrors {
  const errors: RentalFormErrors = {};

  if (step === 1) {
    if (!values.propertyName.trim()) {
      errors.propertyName = "Enter the property or rental name.";
    }
    if (!values.titleKm.trim() && !values.titleEn.trim()) {
      errors.titleKm = "Add a Khmer or English listing title.";
    }
    const totalUnits = parseInteger(values.totalUnits);
    const availableUnits = parseInteger(values.availableUnits);
    if (totalUnits === null || totalUnits < 1 || totalUnits > 10_000) {
      errors.totalUnits = "Enter at least one total room or unit.";
    }
    if (availableUnits === null || availableUnits < 0) {
      errors.availableUnits = "Available rooms cannot be negative.";
    } else if (totalUnits !== null && availableUnits > totalUnits) {
      errors.availableUnits = "Available rooms cannot exceed total rooms.";
    }
    const monthlyPrice = parseMoney(values.monthlyPrice);
    if (monthlyPrice === null || monthlyPrice <= 0) {
      errors.monthlyPrice = "Enter a monthly rent greater than zero.";
    }
    if (values.depositAmount && parseMoney(values.depositAmount) === null) {
      errors.depositAmount = "Enter a valid deposit or leave it blank.";
    }
  }

  if (step === 2) {
    if (!values.addressLine.trim()) {
      errors.addressLine = "Enter an address students can recognize.";
    }
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    if (
      !values.latitude ||
      !Number.isFinite(latitude) ||
      Math.abs(latitude) > 90
    ) {
      errors.latitude =
        "Choose a valid latitude on the map or enter it manually.";
    }
    if (
      !values.longitude ||
      !Number.isFinite(longitude) ||
      Math.abs(longitude) > 180
    ) {
      errors.longitude =
        "Choose a valid longitude on the map or enter it manually.";
    }
  }

  if (step === 3) {
    for (const field of ["bedrooms", "bathrooms"] as const) {
      if (values[field] && parseInteger(values[field]) === null) {
        errors[field] = "Enter a whole number or leave this blank.";
      }
    }
  }

  return errors;
}

export function validateRentalForSave(
  values: RentalFormValues,
  options: { submitForReview: boolean; photoCount: number },
): RentalFormErrors {
  const errors: RentalFormErrors = {};
  for (const step of [1, 2, 3] as const) {
    Object.assign(errors, validateRentalStep(values, step));
  }
  if (options.submitForReview) {
    if (Number(values.availableUnits) < 1) {
      errors.availableUnits =
        "At least one room must be available before review.";
    }
    if (!values.descriptionKm.trim() && !values.descriptionEn.trim()) {
      errors.descriptionKm =
        "Add a Khmer or English description before review.";
    }
    if (options.photoCount < 1) {
      errors.photos = "Add at least one clear photo before review.";
    }
  }
  return errors;
}

export function firstStepWithErrors(errors: RentalFormErrors): ListingFormStep {
  const stepOneFields = new Set([
    "propertyName",
    "titleKm",
    "titleEn",
    "propertyType",
    "totalUnits",
    "availableUnits",
    "monthlyPrice",
    "currency",
    "depositAmount",
  ]);
  const stepTwoFields = new Set([
    "addressLine",
    "latitude",
    "longitude",
    "commune",
    "district",
  ]);
  const stepThreeFields = new Set([
    "descriptionKm",
    "descriptionEn",
    "utilityNotesKm",
    "utilityNotesEn",
    "houseRulesKm",
    "houseRulesEn",
    "bedrooms",
    "bathrooms",
    "furnished",
    "availableFrom",
    "contactPreference",
    "amenityIds",
  ]);
  if (Object.keys(errors).some((field) => stepOneFields.has(field))) return 1;
  if (Object.keys(errors).some((field) => stepTwoFields.has(field))) return 2;
  if (Object.keys(errors).some((field) => stepThreeFields.has(field))) return 3;
  if (errors.photos) return 4;
  return 1;
}

export function buildCreateListingInput(
  values: RentalFormValues,
): CreateLandlordListingInput {
  const commune = optionalText(values.commune);
  const district = optionalText(values.district);
  const googlePlaceId = optionalText(values.googlePlaceId);
  const titleKm = optionalText(values.titleKm);
  const titleEn = optionalText(values.titleEn);
  const descriptionKm = optionalText(values.descriptionKm);
  const descriptionEn = optionalText(values.descriptionEn);
  const utilityNotesKm = optionalText(values.utilityNotesKm);
  const utilityNotesEn = optionalText(values.utilityNotesEn);
  const houseRulesKm = optionalText(values.houseRulesKm);
  const houseRulesEn = optionalText(values.houseRulesEn);
  return {
    property: {
      name: values.propertyName.trim(),
      addressLine: values.addressLine.trim(),
      ...(commune ? { commune } : {}),
      ...(district ? { district } : {}),
      city: "Phnom Penh",
      countryCode: "KH",
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      ...(googlePlaceId ? { googlePlaceId } : {}),
      totalUnits: Number(values.totalUnits),
    },
    ...(titleKm ? { titleKm } : {}),
    ...(titleEn ? { titleEn } : {}),
    ...(descriptionKm ? { descriptionKm } : {}),
    ...(descriptionEn ? { descriptionEn } : {}),
    propertyType: values.propertyType,
    monthlyPrice: Number(values.monthlyPrice),
    currency: values.currency,
    ...(values.depositAmount
      ? { depositAmount: Number(values.depositAmount) }
      : {}),
    ...(utilityNotesKm ? { utilityNotesKm } : {}),
    ...(utilityNotesEn ? { utilityNotesEn } : {}),
    ...(houseRulesKm ? { houseRulesKm } : {}),
    ...(houseRulesEn ? { houseRulesEn } : {}),
    ...(values.bedrooms ? { bedrooms: Number(values.bedrooms) } : {}),
    ...(values.bathrooms ? { bathrooms: Number(values.bathrooms) } : {}),
    furnished: values.furnished,
    ...(values.availableFrom ? { availableFrom: values.availableFrom } : {}),
    availableUnits: Number(values.availableUnits),
    contactPreference: values.contactPreference,
    amenityIds: values.amenityIds,
  };
}

export function buildUpdateListingInput(
  values: RentalFormValues,
): UpdateLandlordListingInput {
  return {
    property: {
      name: values.propertyName.trim(),
      addressLine: values.addressLine.trim(),
      commune: optionalText(values.commune) ?? null,
      district: optionalText(values.district) ?? null,
      city: "Phnom Penh",
      countryCode: "KH",
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      googlePlaceId: optionalText(values.googlePlaceId) ?? null,
      totalUnits: Number(values.totalUnits),
    },
    titleKm: optionalText(values.titleKm) ?? null,
    titleEn: optionalText(values.titleEn) ?? null,
    descriptionKm: optionalText(values.descriptionKm) ?? null,
    descriptionEn: optionalText(values.descriptionEn) ?? null,
    propertyType: values.propertyType,
    monthlyPrice: Number(values.monthlyPrice),
    currency: values.currency,
    depositAmount: values.depositAmount ? Number(values.depositAmount) : null,
    utilityNotesKm: optionalText(values.utilityNotesKm) ?? null,
    utilityNotesEn: optionalText(values.utilityNotesEn) ?? null,
    houseRulesKm: optionalText(values.houseRulesKm) ?? null,
    houseRulesEn: optionalText(values.houseRulesEn) ?? null,
    bedrooms: values.bedrooms ? Number(values.bedrooms) : null,
    bathrooms: values.bathrooms ? Number(values.bathrooms) : null,
    furnished: values.furnished,
    availableFrom: values.availableFrom || null,
    contactPreference: values.contactPreference,
    amenityIds: values.amenityIds,
  };
}

export function validatePhotoMetadata(file: {
  type: string;
  size: number;
}): string | null {
  if (
    !(ACCEPTED_LISTING_PHOTO_TYPES as readonly string[]).includes(file.type)
  ) {
    return "Use JPEG, PNG, or WebP photos.";
  }
  if (file.size < 1 || file.size > MAX_LISTING_PHOTO_BYTES) {
    return "Each photo must be 10 MB or smaller.";
  }
  return null;
}

function parseInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseMoney(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized || undefined;
}
