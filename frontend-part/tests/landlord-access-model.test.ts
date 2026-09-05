import assert from "node:assert/strict";
import test from "node:test";

import {
  formatLandlordAccessTiming,
  getLandlordAccessPresentation,
} from "../src/features/landlord/landlord-access-model.ts";
import type { LandlordEntitlement } from "../src/features/auth/auth-api.ts";

const baseEntitlement: LandlordEntitlement = {
  status: "TRIALING",
  source: "TRIAL",
  trialStartedAt: "2026-09-01T00:00:00.000Z",
  trialEndsAt: "2026-09-08T00:00:00.000Z",
  accessEndsAt: "2026-09-08T00:00:00.000Z",
  evaluatedAt: "2026-09-05T00:00:00.000Z",
  isAccessActive: true,
  remainingDays: 3,
  capabilities: {
    canReadListings: true,
    canCreateListings: true,
    canSubmitListings: true,
    canPublishListings: true,
    canIncreaseAvailability: true,
  },
};

test("presents an active trial with its server-calculated window", () => {
  const presentation = getLandlordAccessPresentation(baseEntitlement);
  assert.equal(presentation.statusLabel, "Trial active");
  assert.equal(presentation.headline, "Your landlord trial is active");
  assert.match(formatLandlordAccessTiming(baseEntitlement), /^3 days left/);
});

test("explains expiry retention without treating suspension as expiry", () => {
  const expired: LandlordEntitlement = {
    ...baseEntitlement,
    status: "EXPIRED",
    isAccessActive: false,
    remainingDays: null,
    capabilities: {
      ...baseEntitlement.capabilities,
      canCreateListings: false,
      canSubmitListings: false,
      canPublishListings: false,
      canIncreaseAvailability: false,
    },
  };
  const expiredPresentation = getLandlordAccessPresentation(expired);
  assert.equal(expiredPresentation.headline, "Your landlord trial has ended");
  assert.match(expiredPresentation.summary, /were not deleted/);
  assert.equal(expiredPresentation.isExpiredTrial, true);

  const suspendedPresentation = getLandlordAccessPresentation({
    ...expired,
    status: "SUSPENDED",
  });
  assert.equal(
    suspendedPresentation.headline,
    "Your landlord access is suspended",
  );
  assert.equal(suspendedPresentation.isExpiredTrial, false);
  assert.match(
    formatLandlordAccessTiming({ ...expired, status: "SUSPENDED" }),
    /^Access window /,
  );
});
