import { ListingStatus } from "../../generated/prisma/client.js";

export type LandlordListingAction =
  "SUBMIT" | "PAUSE" | "MARK_RENTED" | "ARCHIVE";

const transitions: Readonly<
  Record<ListingStatus, Partial<Record<LandlordListingAction, ListingStatus>>>
> = {
  DRAFT: {
    SUBMIT: ListingStatus.PENDING_REVIEW,
    ARCHIVE: ListingStatus.ARCHIVED,
  },
  PENDING_REVIEW: { ARCHIVE: ListingStatus.ARCHIVED },
  PUBLISHED: {
    PAUSE: ListingStatus.PAUSED,
    MARK_RENTED: ListingStatus.RENTED,
  },
  PAUSED: {
    SUBMIT: ListingStatus.PENDING_REVIEW,
    MARK_RENTED: ListingStatus.RENTED,
    ARCHIVE: ListingStatus.ARCHIVED,
  },
  RENTED: {
    SUBMIT: ListingStatus.PENDING_REVIEW,
    ARCHIVE: ListingStatus.ARCHIVED,
  },
  REJECTED: {
    SUBMIT: ListingStatus.PENDING_REVIEW,
    ARCHIVE: ListingStatus.ARCHIVED,
  },
  ARCHIVED: {},
};

const editableStatuses = new Set<ListingStatus>([
  ListingStatus.DRAFT,
  ListingStatus.PAUSED,
  ListingStatus.RENTED,
  ListingStatus.REJECTED,
]);

export function nextListingStatus(
  current: ListingStatus,
  action: LandlordListingAction,
): ListingStatus | null {
  return transitions[current][action] ?? null;
}

export function canEditListing(status: ListingStatus): boolean {
  return editableStatuses.has(status);
}

export function canUpdateAvailability(status: ListingStatus): boolean {
  return status !== ListingStatus.ARCHIVED;
}
