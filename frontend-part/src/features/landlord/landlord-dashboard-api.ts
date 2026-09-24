import type {
  LandlordInquiryDto,
  LandlordListingDto,
  OffsetPageMeta,
} from "@findme/contracts";

import {
  AuthApiError,
  authorizedPageRequest,
  authorizedRequest,
} from "../auth/auth-api.ts";

export async function listLandlordListings(page: number, pageSize: number) {
  const result = await authorizedPageRequest<
    readonly LandlordListingDto[],
    OffsetPageMeta
  >(`/landlord/listings?page=${page}&pageSize=${pageSize}`, { method: "GET" });
  if (!Array.isArray(result.data)) throw invalidAvailabilityResponse();
  result.data.forEach(assertAvailabilityFreshness);
  return result;
}

export function listRecentLandlordInquiries(pageSize: number) {
  return authorizedPageRequest<readonly LandlordInquiryDto[], OffsetPageMeta>(
    `/landlord/inquiries?page=1&pageSize=${pageSize}`,
    { method: "GET" },
  );
}

export async function updateListingAvailability(
  listingId: string,
  availableUnits: number,
): Promise<LandlordListingDto> {
  const result = await authorizedRequest<LandlordListingDto>(
    `/landlord/listings/${listingId}/availability`,
    {
      method: "PATCH",
      body: { availableUnits },
    },
  );
  assertAvailabilityFreshness(result);
  return result;
}

export type DashboardListingCommand =
  "SUBMIT" | "PAUSE" | "MARK_RENTED" | "ARCHIVE";

export function runListingCommand(
  listingId: string,
  command: DashboardListingCommand,
): Promise<LandlordListingDto> {
  switch (command) {
    case "SUBMIT":
      return authorizedRequest(`/landlord/listings/${listingId}/submit`, {
        method: "POST",
        body: {},
      });
    case "PAUSE":
      return authorizedRequest(`/landlord/listings/${listingId}/pause`, {
        method: "POST",
        body: {},
      });
    case "MARK_RENTED":
      return authorizedRequest(`/landlord/listings/${listingId}/mark-rented`, {
        method: "POST",
        body: {},
      });
    case "ARCHIVE":
      return authorizedRequest(`/landlord/listings/${listingId}`, {
        method: "DELETE",
      });
  }
}

function invalidAvailabilityResponse(): AuthApiError {
  return new AuthApiError(
    "Availability information could not be loaded. Please try again.",
    "INVALID_API_RESPONSE",
    [],
  );
}

function assertAvailabilityFreshness(listing: unknown): void {
  if (
    !listing ||
    typeof listing !== "object" ||
    !("availabilityFreshness" in listing)
  )
    throw invalidAvailabilityResponse();
  const value = listing.availabilityFreshness;
  if (
    !value ||
    typeof value !== "object" ||
    !("state" in value) ||
    !["FRESH", "DUE", "STALE", "UNCONFIRMED"].includes(String(value.state)) ||
    !("remindAt" in value) ||
    !("expiresAt" in value)
  )
    throw invalidAvailabilityResponse();
  for (const date of [value.remindAt, value.expiresAt]) {
    if (
      value.state === "UNCONFIRMED"
        ? date !== null
        : typeof date !== "string" || !Number.isFinite(Date.parse(date))
    )
      throw invalidAvailabilityResponse();
  }
}
