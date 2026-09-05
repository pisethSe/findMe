import type {
  LandlordInquiryDto,
  LandlordListingDto,
  OffsetPageMeta,
} from "@findme/contracts";

import { authorizedPageRequest, authorizedRequest } from "../auth/auth-api.ts";

export function listLandlordListings(page: number, pageSize: number) {
  return authorizedPageRequest<readonly LandlordListingDto[], OffsetPageMeta>(
    `/landlord/listings?page=${page}&pageSize=${pageSize}`,
    { method: "GET" },
  );
}

export function listRecentLandlordInquiries(pageSize: number) {
  return authorizedPageRequest<readonly LandlordInquiryDto[], OffsetPageMeta>(
    `/landlord/inquiries?page=1&pageSize=${pageSize}`,
    { method: "GET" },
  );
}

export function updateListingAvailability(
  listingId: string,
  availableUnits: number,
): Promise<LandlordListingDto> {
  return authorizedRequest(`/landlord/listings/${listingId}/availability`, {
    method: "PATCH",
    body: { availableUnits },
  });
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
