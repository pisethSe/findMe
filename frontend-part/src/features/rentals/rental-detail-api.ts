import type { PublicListingDetailDto } from "@findme/contracts";

import {
  isInstitution,
  isPrimaryImage,
  isPublicListing,
} from "../search/search-api.ts";

export async function getRentalDetail(
  slug: string,
  institutionId?: string,
): Promise<PublicListingDetailDto | null> {
  if (!isRentalSlug(slug)) return null;
  const query = institutionId
    ? `?${new URLSearchParams({ institutionId })}`
    : "";
  const base =
    process.env.API_INTERNAL_BASE_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:3001/api/v1";
  const response = await fetch(
    `${base}/listings/${encodeURIComponent(slug)}${query}`,
    { cache: "no-store", signal: AbortSignal.timeout(10_000) },
  );
  if (response.status === 404) {
    const payload: unknown = await response.json();
    if (
      isRecord(payload) &&
      isRecord(payload.error) &&
      payload.error.code === "LISTING_NOT_FOUND"
    )
      return null;
    throw new Error(
      "The selected institution is unavailable. Return to search and choose an institution.",
    );
  }
  if (!response.ok)
    throw new Error("FindMe could not load this rental. Please try again.");
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRentalDetail(payload.data))
    throw new Error("FindMe received an invalid rental response.");
  return payload.data;
}

export function isRentalSlug(value: string): boolean {
  return value.length <= 180 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isRentalDetail(
  value: unknown,
): value is PublicListingDetailDto {
  if (!isRecord(value)) return false;
  if (
    !isPublicListing({
      ...value,
      distanceMeters: value.distanceMeters ?? 0,
      primaryImage: null,
    })
  )
    return false;
  const nullableText = [
    "descriptionKm",
    "descriptionEn",
    "utilityNotesKm",
    "utilityNotesEn",
    "houseRulesKm",
    "houseRulesEn",
  ];
  if (
    !nullableText.every(
      (key) => value[key] === null || typeof value[key] === "string",
    )
  )
    return false;
  const contact = value.contact;
  return (
    nullableNumber(value.depositAmount) &&
    [value.bedrooms, value.bathrooms].every(
      (count) =>
        nullableNumber(count) && (count === null || Number.isInteger(count)),
    ) &&
    typeof value.furnished === "boolean" &&
    typeof value.updatedAt === "string" &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    nullableNumber(value.distanceMeters) &&
    ((value.institution === null && value.distanceMeters === null) ||
      (isInstitution(value.institution) &&
        typeof value.distanceMeters === "number")) &&
    isRecord(value.location) &&
    typeof value.location.addressLine === "string" &&
    Array.isArray(value.images) &&
    value.images.every(
      (image) =>
        isPrimaryImage(image) &&
        isRecord(image) &&
        safePhotoUrl(image.publicUrl),
    ) &&
    isRecord(contact) &&
    ["IN_APP_ONLY", "PHONE", "TELEGRAM", "PHONE_OR_TELEGRAM"].includes(
      String(contact.preference),
    ) &&
    [contact.displayName, contact.phone, contact.telegram].every(
      (text) => text === null || typeof text === "string",
    ) &&
    (["PHONE", "PHONE_OR_TELEGRAM"].includes(String(contact.preference)) ||
      contact.phone === null) &&
    (["TELEGRAM", "PHONE_OR_TELEGRAM"].includes(String(contact.preference)) ||
      contact.telegram === null)
  );
}

function nullableNumber(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safePhotoUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
