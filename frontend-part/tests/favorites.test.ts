import assert from "node:assert/strict";
import test from "node:test";
import { isFavoritesPage } from "../src/features/favorites/favorites-api.ts";
import {
  safeStudentReturnPath,
  studentDestination,
} from "../src/features/auth/student-return-path.ts";
import { listings } from "./browser/fixtures.ts";

test("favorite responses validate identity, availability, pagination and redacted rows", () => {
  const listing = listings[0];
  assert.ok(listing);
  const row = {
    listingId: listing.id,
    savedAt: "2026-09-06T00:00:00Z",
    listing,
  };
  const page = {
    data: [row],
    meta: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
  };
  assert.equal(isFavoritesPage(page), true);
  assert.equal(
    isFavoritesPage({ ...page, data: [{ ...row, listing: null }] }),
    true,
  );
  for (const broken of [
    { ...row, listingId: "bad" },
    { ...row, savedAt: "bad" },
    { ...row, listing: { ...listing, id: "mismatch" } },
    { ...row, listing: { ...listing, availableUnits: 0 } },
    { ...row, listing: { ...listing, monthlyPrice: "125" } },
  ])
    assert.equal(isFavoritesPage({ ...page, data: [broken] }), false);
  assert.equal(isFavoritesPage({ ...page, data: [row, row] }), false);
  assert.equal(
    isFavoritesPage({ ...page, meta: { ...page.meta, totalPages: 2 } }),
    false,
  );
  assert.equal(isFavoritesPage({ ...page, data: [] }), false);
});

test("student return paths cannot override server role routing or leave the site", () => {
  for (const path of [
    "/favorites",
    "/search?institution=rupp&page=2",
    "/rentals/room-near-rupp",
  ])
    assert.equal(safeStudentReturnPath(path), path);
  for (const path of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/admin",
    "/landlord",
    "/rentals/../admin",
    "/favorites#evil",
    "/favorites\n",
    "/rentals/%2f%2fevil.test",
    "/favorites?" + "a".repeat(4096),
  ])
    assert.equal(safeStudentReturnPath(path), null, path);
  assert.equal(
    studentDestination(
      { nextPath: "/search", studentPreference: null },
      "/favorites",
    ),
    "/favorites",
  );
  assert.equal(
    studentDestination(
      { nextPath: "/onboarding/role", studentPreference: null },
      "/favorites",
    ),
    "/onboarding/role?next=%2Ffavorites",
  );
  // Unfinished onboarding is server-owned and must not be skipped for a
  // return target. Completed landlord and admin routes may still follow one.
  assert.equal(
    studentDestination(
      { nextPath: "/onboarding/landlord", studentPreference: null },
      "/favorites",
    ),
    "/onboarding/landlord",
  );
  for (const path of ["/landlord", "/admin"] as const)
    assert.equal(
      studentDestination(
        { nextPath: path, studentPreference: null },
        "/favorites",
      ),
      "/favorites",
    );
});
