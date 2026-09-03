export const LISTING_STATUSES = [
  "draft",
  "pending_review",
  "active",
  "paused",
  "rented",
  "rejected",
  "expired",
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

const ALLOWED_TRANSITIONS: Readonly<
  Record<ListingStatus, readonly ListingStatus[]>
> = {
  draft: ["pending_review"],
  pending_review: ["active", "rejected", "draft"],
  active: ["paused", "rented", "expired", "pending_review"],
  paused: ["active", "rented", "expired", "draft"],
  rented: ["draft"],
  rejected: ["draft"],
  expired: ["draft"],
};

export interface PublishReadiness {
  ownerPhoneVerified: boolean;
  hasExactLocation: boolean;
  imageCount: number;
  hasRent: boolean;
  hasUtilityDisclosure: boolean;
  hasAvailability: boolean;
}

export interface FreshnessPolicy {
  recentDays: number;
  expiresAfterDays: number;
}

export const DEFAULT_FRESHNESS_POLICY: FreshnessPolicy = {
  recentDays: 14,
  expiresAfterDays: 30,
};

export type ListingFreshness = "recent" | "stale" | "expired" | "unconfirmed";

export function canTransitionListing(
  from: ListingStatus,
  to: ListingStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionListing(
  from: ListingStatus,
  to: ListingStatus,
): ListingStatus {
  if (!canTransitionListing(from, to)) {
    throw new Error(`Listing cannot transition from ${from} to ${to}.`);
  }

  return to;
}

export function getPublishBlockingReasons(
  input: PublishReadiness,
): readonly string[] {
  const reasons: string[] = [];

  if (!input.ownerPhoneVerified)
    reasons.push("Verify the owner's phone number.");
  if (!input.hasExactLocation)
    reasons.push("Pin the property's exact location.");
  if (input.imageCount < 3)
    reasons.push("Upload at least three property photos.");
  if (!input.hasRent) reasons.push("Add the monthly base rent.");
  if (!input.hasUtilityDisclosure) reasons.push("Disclose utility pricing.");
  if (!input.hasAvailability) reasons.push("Confirm room availability.");

  return reasons;
}

export function getListingFreshness(
  confirmedAt: Date | null,
  now = new Date(),
  policy: FreshnessPolicy = DEFAULT_FRESHNESS_POLICY,
): ListingFreshness {
  if (!confirmedAt) return "unconfirmed";
  if (confirmedAt.getTime() > now.getTime()) {
    throw new RangeError("Availability confirmation cannot be in the future.");
  }
  if (policy.recentDays < 0 || policy.expiresAfterDays <= policy.recentDays) {
    throw new RangeError("Freshness policy thresholds are invalid.");
  }

  const ageMs = now.getTime() - confirmedAt.getTime();
  const ageDays = ageMs / 86_400_000;

  if (ageDays <= policy.recentDays) return "recent";
  if (ageDays <= policy.expiresAfterDays) return "stale";
  return "expired";
}

export interface DiscoverabilityInput {
  status: ListingStatus;
  moderationApproved: boolean;
  confirmedAt: Date | null;
}

export function isListingDiscoverable(
  input: DiscoverabilityInput,
  now = new Date(),
): boolean {
  if (input.status !== "active" || !input.moderationApproved) return false;

  const freshness = getListingFreshness(input.confirmedAt, now);
  return freshness === "recent" || freshness === "stale";
}
