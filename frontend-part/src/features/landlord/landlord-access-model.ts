import type { LandlordEntitlement } from "../auth/auth-api";

export interface LandlordAccessPresentation {
  statusLabel: string;
  headline: string;
  summary: string;
  isExpiredTrial: boolean;
}

export function getLandlordAccessPresentation(
  entitlement: LandlordEntitlement,
): LandlordAccessPresentation {
  if (entitlement.isAccessActive) {
    const isTrial = entitlement.source === "TRIAL";
    return {
      statusLabel: isTrial ? "Trial active" : "Access active",
      headline: isTrial
        ? "Your landlord trial is active"
        : "Your landlord access is active",
      summary:
        "You can create rentals, submit them for review, publish approved inventory, and increase availability.",
      isExpiredTrial: false,
    };
  }

  switch (entitlement.status) {
    case "EXPIRED":
      return {
        statusLabel: "Access expired",
        headline:
          entitlement.source === "TRIAL"
            ? "Your landlord trial has ended"
            : "Your landlord access has expired",
        summary:
          "Published rentals tied to this access were paused automatically. Your property details, rental drafts, photos, and student inquiries were not deleted.",
        isExpiredTrial: entitlement.source === "TRIAL",
      };
    case "SUSPENDED":
      return {
        statusLabel: "Access suspended",
        headline: "Your landlord access is suspended",
        summary:
          "Restricted supply actions are unavailable. Your existing rental information and inquiries remain available to read.",
        isExpiredTrial: false,
      };
    case "CANCELLED":
      return {
        statusLabel: "Access cancelled",
        headline: "Your landlord access is cancelled",
        summary:
          "Restricted supply actions are unavailable. Your existing rental information and inquiries remain available to read.",
        isExpiredTrial: false,
      };
    case "TRIALING":
    case "ACTIVE":
      return {
        statusLabel: "Access inactive",
        headline: "Your landlord access is inactive",
        summary:
          "Restricted supply actions are unavailable. Your existing rental information and inquiries remain available to read.",
        isExpiredTrial: false,
      };
  }
}

export function formatLandlordAccessTiming(
  entitlement: LandlordEntitlement,
): string {
  if (!entitlement.accessEndsAt) return "No scheduled end date";
  if (!entitlement.isAccessActive) {
    const label = entitlement.status === "EXPIRED" ? "Ended" : "Access window";
    return `${label} ${formatLandlordAccessDate(entitlement.accessEndsAt)}`;
  }
  const days = entitlement.remainingDays ?? 0;
  return `${formatAccessCount(days, "day", "days")} left · ends ${formatLandlordAccessDate(entitlement.accessEndsAt)}`;
}

export function formatLandlordAccessDate(value: string): string {
  return new Intl.DateTimeFormat("en-KH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Phnom_Penh",
  }).format(new Date(value));
}

function formatAccessCount(
  value: number,
  singular: string,
  plural: string,
): string {
  return `${new Intl.NumberFormat("en-KH").format(value)} ${
    value === 1 ? singular : plural
  }`;
}
