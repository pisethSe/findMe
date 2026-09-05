import assert from "node:assert/strict";
import test from "node:test";

import type { LandlordListingDto, ListingStatus } from "@findme/contracts";

import {
  canEditListingFromDashboard,
  formatAvailabilityFreshness,
  getListingStatusPresentation,
  getListingTitle,
  listingCommandsForStatus,
  mergeListingPages,
  validateAvailabilityChange,
} from "../src/features/landlord/landlord-dashboard-model.ts";

function listing(
  id: string,
  overrides: Partial<LandlordListingDto> = {},
): LandlordListingDto {
  return {
    id,
    slug: `rental-${id}`,
    titleKm: "បន្ទប់ជួល",
    titleEn: "Student room",
    descriptionKm: null,
    descriptionEn: null,
    propertyType: "ROOM",
    monthlyPrice: 95,
    currency: "USD",
    depositAmount: null,
    utilityNotesKm: null,
    utilityNotesEn: null,
    houseRulesKm: null,
    houseRulesEn: null,
    bedrooms: null,
    bathrooms: null,
    furnished: false,
    availableFrom: null,
    availableUnits: 2,
    availabilityConfirmedAt: "2026-09-04T00:00:00.000Z",
    contactPreference: "IN_APP_ONLY",
    status: "DRAFT",
    publishedAt: null,
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
    property: {
      id: `property-${id}`,
      name: "RUPP rooms",
      addressLine: "Russian Federation Boulevard",
      commune: null,
      district: "Tuol Kork",
      city: "Phnom Penh",
      countryCode: "KH",
      latitude: 11.569,
      longitude: 104.8914,
      googlePlaceId: null,
      totalUnits: 4,
    },
    amenities: [],
    images: [],
    ...overrides,
  };
}

test("maps each publication state to its valid dashboard commands", () => {
  const expected: Record<ListingStatus, readonly string[]> = {
    DRAFT: ["SUBMIT", "ARCHIVE"],
    PENDING_REVIEW: ["ARCHIVE"],
    PUBLISHED: ["PAUSE", "MARK_RENTED"],
    PAUSED: ["SUBMIT", "MARK_RENTED", "ARCHIVE"],
    RENTED: ["SUBMIT", "ARCHIVE"],
    REJECTED: ["SUBMIT", "ARCHIVE"],
    ARCHIVED: [],
  };

  for (const [status, commands] of Object.entries(expected)) {
    assert.deepEqual(
      listingCommandsForStatus(status as ListingStatus),
      commands,
    );
    assert.ok(getListingStatusPresentation(status as ListingStatus).label);
  }
});

test("only server-editable publication states show the edit route", () => {
  assert.equal(canEditListingFromDashboard("DRAFT"), true);
  assert.equal(canEditListingFromDashboard("PAUSED"), true);
  assert.equal(canEditListingFromDashboard("RENTED"), true);
  assert.equal(canEditListingFromDashboard("REJECTED"), true);
  assert.equal(canEditListingFromDashboard("PENDING_REVIEW"), false);
  assert.equal(canEditListingFromDashboard("PUBLISHED"), false);
  assert.equal(canEditListingFromDashboard("ARCHIVED"), false);
});

test("never presents a metadata update as an availability confirmation", () => {
  assert.equal(
    formatAvailabilityFreshness(null),
    "Availability not confirmed yet.",
  );
  assert.match(
    formatAvailabilityFreshness("2026-09-04T00:00:00.000Z"),
    /^Last confirmed /,
  );
});

test("expired access permits availability reductions but rejects increases", () => {
  const current = listing("one");

  assert.equal(validateAvailabilityChange(current, "1", false), null);
  assert.equal(validateAvailabilityChange(current, "2", false), null);
  assert.match(
    validateAvailabilityChange(current, "3", false) ?? "",
    /Access is required/,
  );
});

test("availability remains a bounded whole number and archived rentals are read only", () => {
  const current = listing("one");

  assert.match(validateAvailabilityChange(current, "1.5", true) ?? "", /whole/);
  assert.match(
    validateAvailabilityChange(current, "5", true) ?? "",
    /4 or fewer/,
  );
  assert.match(
    validateAvailabilityChange(
      listing("archived", { status: "ARCHIVED" }),
      "1",
      true,
    ) ?? "",
    /read only/,
  );
});

test("merges paginated rentals by id and keeps the newest record", () => {
  const first = listing("one");
  const second = listing("two");
  const updatedFirst = listing("one", { availableUnits: 1 });

  assert.deepEqual(
    mergeListingPages([first], [updatedFirst, second]).map((item) => [
      item.id,
      item.availableUnits,
    ]),
    [
      ["one", 1],
      ["two", 2],
    ],
  );
});

test("uses Khmer, English, then property name for the rental title", () => {
  assert.equal(getListingTitle(listing("km")), "បន្ទប់ជួល");
  assert.equal(
    getListingTitle(listing("en", { titleKm: null })),
    "Student room",
  );
  assert.equal(
    getListingTitle(listing("property", { titleKm: null, titleEn: null })),
    "RUPP rooms",
  );
});
