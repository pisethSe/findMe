import assert from "node:assert/strict";
import test from "node:test";

import { toOnboardingState } from "../dist/modules/onboarding/onboarding.service.js";

const baseUser = {
  id: "00000000-0000-4000-8000-000000000301",
  accountStatus: "ACTIVE",
  deletedAt: null,
  studentProfile: null,
  landlordProfile: null,
  landlordEntitlement: null,
};

test("routes each server-owned onboarding state to its appropriate product area", () => {
  assert.equal(
    toOnboardingState({
      ...baseUser,
      role: null,
      onboardingCompletedAt: null,
    }).nextPath,
    "/onboarding/role",
  );

  assert.deepEqual(
    toOnboardingState({
      ...baseUser,
      role: "STUDENT",
      onboardingCompletedAt: new Date(),
      studentProfile: { displayName: "Sokha" },
    }),
    {
      role: "STUDENT",
      stage: "COMPLETE",
      nextPath: "/search",
      roleSelectionComplete: true,
      profileComplete: true,
      landlordTrialActivated: false,
    },
  );

  assert.equal(
    toOnboardingState({
      ...baseUser,
      role: "LANDLORD",
      onboardingCompletedAt: new Date(),
    }).nextPath,
    "/onboarding/landlord",
  );

  assert.deepEqual(
    toOnboardingState({
      ...baseUser,
      role: "LANDLORD",
      onboardingCompletedAt: new Date(),
      landlordProfile: {
        userId: "00000000-0000-4000-8000-000000000301",
      },
      landlordEntitlement: {
        landlordId: "00000000-0000-4000-8000-000000000301",
      },
    }),
    {
      role: "LANDLORD",
      stage: "COMPLETE",
      nextPath: "/landlord",
      roleSelectionComplete: true,
      profileComplete: true,
      landlordTrialActivated: true,
    },
  );

  assert.equal(
    toOnboardingState({
      ...baseUser,
      role: "ADMIN",
      onboardingCompletedAt: new Date(),
    }).nextPath,
    "/admin",
  );
});
