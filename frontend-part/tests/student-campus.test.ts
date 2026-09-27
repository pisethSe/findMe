import assert from "node:assert/strict";
import test from "node:test";

import type { StudentPreference } from "../src/features/auth/auth-api.ts";
import {
  studentCampusSearchPath,
  studentDestination,
} from "../src/features/auth/student-return-path.ts";

const rupp: StudentPreference = {
  institutionId: "00000000-0000-4000-8000-000000000401",
  institutionSlug: "royal-university-of-phnom-penh",
  institutionNameEn: "Royal University of Phnom Penh",
  institutionNameKm: "សាលាពន្យល័យជាតិព្រះនរោត្តមភ្នំពេញ",
  preferredRadiusMeters: 3_000,
};

test("routes a student to the campus saved during onboarding", () => {
  assert.equal(
    studentCampusSearchPath(rupp),
    "/search?institution=royal-university-of-phnom-penh&maxDistanceKm=3",
  );
  assert.equal(
    studentDestination({ nextPath: "/", studentPreference: rupp }, null),
    "/search?institution=royal-university-of-phnom-penh&maxDistanceKm=3",
  );
});

test("a saved campus stays a default and never overrides a safe deep link", () => {
  assert.equal(
    studentDestination(
      { nextPath: "/", studentPreference: rupp },
      "/rentals/quiet-room",
    ),
    "/rentals/quiet-room",
  );
  // An unsafe return target is discarded rather than replacing the campus.
  assert.equal(
    studentDestination(
      { nextPath: "/", studentPreference: rupp },
      "https://example.test/phish",
    ),
    "/search?institution=royal-university-of-phnom-penh&maxDistanceKm=3",
  );
});

test("falls back to the normal route when no campus is saved", () => {
  assert.equal(studentCampusSearchPath(null), null);
  assert.equal(
    studentDestination({ nextPath: "/", studentPreference: null }, null),
    "/",
  );
});

test("refuses to build a search URL from an unsafe campus slug", () => {
  assert.equal(
    studentCampusSearchPath({
      ...rupp,
      institutionSlug: "../../etc/passwd",
    }),
    null,
  );
  assert.equal(studentCampusSearchPath({ ...rupp, institutionSlug: "" }), null);
});

test("omits the radius when the student saved only a campus", () => {
  assert.equal(
    studentCampusSearchPath({ ...rupp, preferredRadiusMeters: null }),
    "/search?institution=royal-university-of-phnom-penh",
  );
});

test("a new account still completes role selection before any deep link", () => {
  // Incomplete onboarding must win, carrying the return target through as
  // `next` instead of sending the new student straight to search.
  assert.equal(
    studentDestination(
      { nextPath: "/onboarding/role", studentPreference: null },
      "/search?maxRentUsd=150",
    ),
    "/onboarding/role?next=%2Fsearch%3FmaxRentUsd%3D150",
  );
  assert.equal(
    studentDestination(
      { nextPath: "/onboarding/role", studentPreference: null },
      null,
    ),
    "/onboarding/role",
  );
});

test("an incomplete landlord route is never replaced by a campus", () => {
  assert.equal(
    studentDestination(
      { nextPath: "/onboarding/landlord", studentPreference: null },
      "/favorites",
    ),
    "/onboarding/landlord",
  );
  assert.equal(
    studentDestination({ nextPath: "/admin", studentPreference: rupp }, null),
    "/admin",
  );
});
