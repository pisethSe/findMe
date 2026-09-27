import type { Currency, PropertyType } from "@findme/contracts";

import { roomTypeEnglishLabel } from "./room-type-options.ts";

/**
 * Shared rental-presentation formatting for the search card list and the
 * selected-rental map popup, so both surfaces always agree on the same numbers
 * and wording.
 */
export function rentalPropertyTypeLabel(value: PropertyType): string {
  return roomTypeEnglishLabel(value);
}

export function formatListingPrice(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KHR" ? 0 : 2,
  }).format(amount);
}

export function formatListingDistance(distanceMeters: number): string {
  if (distanceMeters < 1_000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1_000).toFixed(1)} km`;
}

export function formatAvailabilityDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Phnom_Penh",
  }).format(new Date(value));
}

/** Availability copy that never depends on colour alone. */
export function describeAvailableUnits(availableUnits: number): string {
  if (availableUnits <= 0) return "No rooms available now";
  return `${availableUnits} ${availableUnits === 1 ? "room" : "rooms"} available`;
}
