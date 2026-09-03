import type {
  EntitlementSource,
  EntitlementStatus,
} from "../../generated/prisma/client.js";

export interface EntitlementPolicyInput {
  status: EntitlementStatus;
  source: EntitlementSource;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  accessEndsAt: Date | null;
}

export interface EntitlementAccess {
  status: EntitlementStatus;
  source: EntitlementSource;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  accessEndsAt: Date | null;
  evaluatedAt: Date;
  isAccessActive: boolean;
  remainingDays: number | null;
  capabilities: {
    canReadListings: true;
    canCreateListings: boolean;
    canSubmitListings: boolean;
    canPublishListings: boolean;
    canIncreaseAvailability: boolean;
  };
}

export function evaluateEntitlement(
  entitlement: EntitlementPolicyInput,
  now: Date,
): EntitlementAccess {
  const statusCanGrantAccess =
    entitlement.status === "TRIALING" || entitlement.status === "ACTIVE";
  const hasValidWindow =
    entitlement.status === "TRIALING"
      ? entitlement.accessEndsAt !== null && entitlement.accessEndsAt > now
      : entitlement.accessEndsAt === null || entitlement.accessEndsAt > now;
  const isAccessActive = statusCanGrantAccess && hasValidWindow;
  const remainingDays =
    isAccessActive && entitlement.accessEndsAt
      ? Math.max(
          1,
          Math.ceil(
            (entitlement.accessEndsAt.getTime() - now.getTime()) /
              (24 * 60 * 60 * 1_000),
          ),
        )
      : null;

  return {
    ...entitlement,
    evaluatedAt: now,
    isAccessActive,
    remainingDays,
    capabilities: {
      canReadListings: true,
      canCreateListings: isAccessActive,
      canSubmitListings: isAccessActive,
      canPublishListings: isAccessActive,
      canIncreaseAvailability: isAccessActive,
    },
  };
}
