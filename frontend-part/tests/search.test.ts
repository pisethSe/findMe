import assert from "node:assert/strict";
import test from "node:test";

import {
  createDemoListings,
  DEMO_UNIVERSITIES,
  isInsidePhnomPenhDemoBounds,
} from "../src/data/demo.ts";
import {
  distanceInKm,
  searchListings,
  UniversityNotFoundError,
} from "../src/domain/search.ts";
import {
  InvalidSearchQueryError,
  parseSearchQuery,
} from "../src/server/search-query.ts";

const NOW = new Date("2026-09-01T00:00:00.000Z");

test("calculates a plausible distance between the RUPP and ITC campuses", () => {
  const distance = distanceInKm(
    DEMO_UNIVERSITIES[0]!.location,
    DEMO_UNIVERSITIES[1]!.location,
  );

  assert.ok(distance > 0.5 && distance < 1);
});

test("returns only discoverable listings near the selected university", () => {
  const results = searchListings(
    DEMO_UNIVERSITIES,
    createDemoListings(NOW),
    {
      universitySlug: "rupp",
      maxDistanceKm: 2,
      maxRentUsdMinor: 12_000,
    },
    NOW,
  );
  const ids = results.map((result) => result.listing.id);

  assert.ok(ids.includes("demo-teuk-laak-study-room"));
  assert.ok(ids.includes("demo-techno-private-room"));
  assert.ok(!ids.includes("demo-expired-room"));
  assert.ok(!ids.includes("demo-pending-review-room"));
  assert.ok(!ids.includes("demo-toul-kork-studio"));
});

test("applies room type and rent filters", () => {
  const results = searchListings(
    DEMO_UNIVERSITIES,
    createDemoListings(NOW),
    {
      universitySlug: "itc",
      maxDistanceKm: 3,
      maxRentUsdMinor: 8_000,
      roomType: "shared_room",
    },
    NOW,
  );

  assert.deepEqual(
    results.map((result) => result.listing.id),
    ["demo-russian-boulevard-shared-room"],
  );
});

test("rejects an unknown university", () => {
  assert.throws(
    () =>
      searchListings(
        DEMO_UNIVERSITIES,
        createDemoListings(NOW),
        { universitySlug: "missing" },
        NOW,
      ),
    UniversityNotFoundError,
  );
});

test("parses API query values into domain filters", () => {
  const filters = parseSearchQuery(
    new URL(
      "https://findme.example/api/v1/listings?university=rupp&maxRentUsd=85&maxDistanceKm=3&roomType=private_room",
    ),
  );

  assert.deepEqual(filters, {
    universitySlug: "rupp",
    maxRentUsdMinor: 8_500,
    maxDistanceKm: 3,
    roomType: "private_room",
  });
});

test("rejects incomplete or invalid API queries", () => {
  assert.throws(
    () => parseSearchQuery(new URL("https://findme.example/api/v1/listings")),
    InvalidSearchQueryError,
  );
  assert.throws(
    () =>
      parseSearchQuery(
        new URL(
          "https://findme.example/api/v1/listings?university=rupp&maxRentUsd=-1",
        ),
      ),
    /Maximum rent must be a positive number/,
  );
});

test("keeps all demonstration institutions and rentals inside Phnom Penh", () => {
  const listings = createDemoListings(NOW);

  assert.ok(
    DEMO_UNIVERSITIES.every((institution) =>
      isInsidePhnomPenhDemoBounds(institution.location),
    ),
  );
  assert.ok(
    listings.every(
      (listing) =>
        listing.dataSource === "demo" &&
        isInsidePhnomPenhDemoBounds(listing.publicLocation),
    ),
  );
  assert.ok(listings.some((listing) => listing.roomType === "house"));
});
