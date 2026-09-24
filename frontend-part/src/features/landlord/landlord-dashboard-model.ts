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
  freshness?: LandlordListingDto["availabilityFreshness"],
): ListingStatusPresentation {
  if (
    status === "PUBLISHED" &&
    freshness &&
    ["STALE", "UNCONFIRMED"].includes(freshness.state)
  ) {
    return {
      label: "Availability overdue",
      detail: "Hidden from students",
      tone: "warning",
    };
  }
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

export function availabilityReminder(
  listing: LandlordListingDto,
): string | null {
  if (!["PUBLISHED", "PENDING_REVIEW"].includes(listing.status)) return null;
  const freshness = listing.availabilityFreshness;
  if (freshness.state === "STALE" || freshness.state === "UNCONFIRMED") {
    return listing.status === "PUBLISHED"
      ? "Hidden from students until you confirm how many rooms are available."
      : "Confirm availability again before this rental can be published.";
  }
  if (freshness.state === "DUE" && freshness.expiresAt) {
    const deadline = new Intl.DateTimeFormat("en-KH", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Phnom_Penh",
    }).format(new Date(freshness.expiresAt));
    return `Confirm availability by ${deadline} (Cambodia time) ${listing.status === "PUBLISHED" ? "to keep this rental visible to students" : "so this rental stays ready for publication"}.`;
  }
  return null;
}
