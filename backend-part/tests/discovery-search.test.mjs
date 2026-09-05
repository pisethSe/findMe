import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";

import { SearchPublicListingsDto } from "../dist/modules/discovery/dto/search-public-listings.dto.js";
import { normalizePublicSearchQuery } from "../dist/modules/discovery/discovery.service.js";

const institutionId = "4f981334-aed1-4f56-bc64-35c51c563906";

function searchQuery(overrides = {}) {
  return Object.assign(new SearchPublicListingsDto(), {
    institutionId,
    ...overrides,
  });
}

function errorCode(run) {
  try {
    run();
    assert.fail("Expected search normalization to fail.");
  } catch (error) {
    const response = error?.getResponse?.();
    return typeof response === "object" && response ? response.code : null;
  }
}

test("normalizes a stable cache-ready rental search", () => {
  const normalized = normalizePublicSearchQuery(
    searchQuery({
      propertyTypes: ["STUDIO", "ROOM"],
      amenities: ["wifi", "air_conditioning"],
      north: 11.59,
      south: 11.55,
      east: 104.92,
      west: 104.87,
    }),
    new Date("2026-09-05T18:00:00.000Z"),
  );

  assert.deepEqual(normalized.propertyTypes, ["ROOM", "STUDIO"]);
  assert.deepEqual(normalized.amenities, ["air_conditioning", "wifi"]);
  assert.equal(normalized.availableBy, "2026-09-06");
  assert.deepEqual(normalized.viewport, {
    north: 11.59,
    south: 11.55,
    east: 104.92,
    west: 104.87,
  });
  assert.equal(normalized.radiusMeters, 5_000);
  assert.equal(normalized.sort, "distance");
  assert.equal(normalized.page, 1);
  assert.equal(normalized.pageSize, 20);
});

test("rejects ambiguous or contradictory rental filters", () => {
  assert.equal(
    errorCode(() => normalizePublicSearchQuery(searchQuery({ maxPrice: 100 }))),
    "SEARCH_CURRENCY_REQUIRED",
  );
  assert.equal(
    errorCode(() =>
      normalizePublicSearchQuery(
        searchQuery({ minPrice: 200, maxPrice: 100, currency: "USD" }),
      ),
    ),
    "SEARCH_PRICE_RANGE_INVALID",
  );
  assert.equal(
    errorCode(() =>
      normalizePublicSearchQuery(
        searchQuery({ propertyType: "ROOM", propertyTypes: ["STUDIO"] }),
      ),
    ),
    "SEARCH_PROPERTY_TYPE_CONFLICT",
  );
});

test("requires complete, ordered map bounds and a real availability date", () => {
  assert.equal(
    errorCode(() => normalizePublicSearchQuery(searchQuery({ north: 11.59 }))),
    "SEARCH_VIEWPORT_INCOMPLETE",
  );
  assert.equal(
    errorCode(() =>
      normalizePublicSearchQuery(
        searchQuery({
          north: 11.55,
          south: 11.59,
          east: 104.87,
          west: 104.92,
        }),
      ),
    ),
    "SEARCH_VIEWPORT_INVALID",
  );
  assert.equal(
    errorCode(() =>
      normalizePublicSearchQuery(searchQuery({ availableBy: "2026-02-30" })),
    ),
    "SEARCH_AVAILABLE_BY_INVALID",
  );
});
