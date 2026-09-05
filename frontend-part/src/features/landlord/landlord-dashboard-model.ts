import type { LandlordListingDto, ListingStatus } from "@findme/contracts";

import type { DashboardListingCommand } from "./landlord-dashboard-api";

export interface ListingStatusPresentation {
  label: string;
  detail: string;
  tone: "neutral" | "positive" | "warning" | "negative";
}

const STATUS_PRESENTATION: Record<ListingStatus, ListingStatusPresentation> = {
  DRAFT: { label: "Draft", detail: "Private", tone: "neutral" },
  PENDING_REVIEW: {
    label: "In review",
    detail: "Private",
    tone: "warning",
  },
  PUBLISHED: {
    label: "Published",
    detail: "Visible to students",
    tone: "positive",
  },
  PAUSED: { label: "Paused", detail: "Hidden", tone: "warning" },
  RENTED: { label: "Rented", detail: "Unavailable", tone: "neutral" },
  REJECTED: {
    label: "Changes requested",
    detail: "Hidden",
    tone: "negative",
  },
  ARCHIVED: { label: "Archived", detail: "Read only", tone: "neutral" },
};

export function getListingStatusPresentation(
  status: ListingStatus,
): ListingStatusPresentation {
  return STATUS_PRESENTATION[status];
}

export function getListingTitle(listing: LandlordListingDto): string {
  return listing.titleKm || listing.titleEn || listing.property.name;
}

export function listingCommandsForStatus(
  status: ListingStatus,
): readonly DashboardListingCommand[] {
  switch (status) {
    case "DRAFT":
      return ["SUBMIT", "ARCHIVE"];
    case "PENDING_REVIEW":
      return ["ARCHIVE"];
    case "PUBLISHED":
      return ["PAUSE", "MARK_RENTED"];
    case "PAUSED":
      return ["SUBMIT", "MARK_RENTED", "ARCHIVE"];
    case "RENTED":
    case "REJECTED":
      return ["SUBMIT", "ARCHIVE"];
    case "ARCHIVED":
      return [];
  }
}

export function canEditListingFromDashboard(status: ListingStatus): boolean {
  return ["DRAFT", "PAUSED", "RENTED", "REJECTED"].includes(status);
}

export function formatAvailabilityFreshness(
  availabilityConfirmedAt: string | null,
): string {
  if (!availabilityConfirmedAt) return "Availability not confirmed yet.";
  return `Last confirmed ${new Intl.DateTimeFormat("en-KH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Phnom_Penh",
  }).format(new Date(availabilityConfirmedAt))}.`;
}

export function validateAvailabilityChange(
  listing: Pick<LandlordListingDto, "availableUnits" | "status" | "property">,
  rawValue: string,
  canIncreaseAvailability: boolean,
): string | null {
  if (!/^\d+$/.test(rawValue)) return "Enter a whole number of rooms.";
  const availableUnits = Number(rawValue);
  if (!Number.isSafeInteger(availableUnits)) {
    return "Enter a whole number of rooms.";
  }
  if (listing.status === "ARCHIVED") {
    return "Archived rentals are read only.";
  }
  if (availableUnits > listing.property.totalUnits) {
    return `Enter ${listing.property.totalUnits} or fewer rooms.`;
  }
  if (!canIncreaseAvailability && availableUnits > listing.availableUnits) {
    return "Access is required to increase available rooms.";
  }
  return null;
}

export function mergeListingPages(
  current: readonly LandlordListingDto[],
  nextPage: readonly LandlordListingDto[],
): LandlordListingDto[] {
  const byId = new Map(current.map((listing) => [listing.id, listing]));
  nextPage.forEach((listing) => byId.set(listing.id, listing));
  return [...byId.values()];
}
