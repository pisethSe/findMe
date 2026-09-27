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

const ruppInstitution = {
  id: "00000000-0000-4000-8000-000000000401",
  slug: "royal-university-of-phnom-penh",
  nameEn: "Royal University of Phnom Penh",
  nameKm: "សាលាពន្យល័យជាតិព្រះនរោត្តមភ្នំពេញ",
  isActive: true,
};

function studentProfileWithCampus(overrides = {}) {
  return {
    displayName: "Sokha",
    institutionId: null,
    preferredRadiusMeters: null,
    institution: null,
    ...overrides,
  };
}

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
      studentProfile: studentProfileWithCampus(),
    }),
    {
      role: "STUDENT",
      stage: "COMPLETE",
      nextPath: "/",
      roleSelectionComplete: true,
      profileComplete: true,
      landlordTrialActivated: false,
      studentPreference: null,
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
      studentPreference: null,
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

test("returns the student's saved campus and radius from the server record", () => {
  const state = toOnboardingState({
    ...baseUser,
    role: "STUDENT",
    onboardingCompletedAt: new Date(),
    studentProfile: studentProfileWithCampus({
      institutionId: ruppInstitution.id,
      preferredRadiusMeters: 3_000,
      institution: ruppInstitution,
    }),
  });

  assert.deepEqual(state.studentPreference, {
    institutionId: ruppInstitution.id,
    institutionSlug: ruppInstitution.slug,
    institutionNameEn: ruppInstitution.nameEn,
    institutionNameKm: ruppInstitution.nameKm,
    preferredRadiusMeters: 3_000,
  });
});

test("withholds a campus preference that is missing or no longer active", () => {
  const noCampus = toOnboardingState({
    ...baseUser,
    role: "STUDENT",
    onboardingCompletedAt: new Date(),
    studentProfile: studentProfileWithCampus({ preferredRadiusMeters: 5_000 }),
  });
  assert.equal(noCampus.studentPreference, null);

  const inactiveCampus = toOnboardingState({
    ...baseUser,
    role: "STUDENT",
    onboardingCompletedAt: new Date(),
    studentProfile: studentProfileWithCampus({
      institutionId: ruppInstitution.id,
      institution: { ...ruppInstitution, isActive: false },
    }),
  });
  assert.equal(inactiveCampus.studentPreference, null);
});

test("never exposes a student campus preference on landlord or admin states", () => {
  const landlord = toOnboardingState({
    ...baseUser,
    role: "LANDLORD",
    onboardingCompletedAt: new Date(),
    landlordProfile: { userId: baseUser.id },
    landlordEntitlement: { landlordId: baseUser.id },
  });
  assert.equal(landlord.studentPreference, null);

  const admin = toOnboardingState({
    ...baseUser,
    role: "ADMIN",
    onboardingCompletedAt: new Date(),
  });
  assert.equal(admin.studentPreference, null);
});
