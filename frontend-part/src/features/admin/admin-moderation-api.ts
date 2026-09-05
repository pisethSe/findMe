import type { AdminPendingListingDto, OffsetPageMeta } from "@findme/contracts";

import { authorizedPageRequest, authorizedRequest } from "../auth/auth-api.ts";

export function listPendingListings(page = 1, pageSize = 20) {
  return authorizedPageRequest<
    readonly AdminPendingListingDto[],
    OffsetPageMeta
  >(`/admin/listings/pending?page=${page}&pageSize=${pageSize}`, {
    method: "GET",
  });
}

export function approveListing(
  listingId: string,
): Promise<AdminPendingListingDto> {
  return authorizedRequest(`/admin/listings/${listingId}/approve`, {
    method: "POST",
    body: {},
  });
}

export function rejectListing(
  listingId: string,
  moderationNote: string,
): Promise<AdminPendingListingDto> {
  return authorizedRequest(`/admin/listings/${listingId}/reject`, {
    method: "POST",
    body: { moderationNote },
  });
}
