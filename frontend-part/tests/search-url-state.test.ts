import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSearchMapHref,
  normalizeSearchViewport,
  parseSearchMapState,
  searchViewportsEqual,
} from "../src/features/search/search-url-state.ts";

test("restores a valid page and map viewport from a shared search URL", () => {
  const state = parseSearchMapState({
    page: "3",
    north: "11.590004",
    south: "11.550004",
    east: "104.920004",
    west: "104.870004",
  });

  assert.deepEqual(state, {
    page: 3,
    viewport: {
      north: 11.59,
      south: 11.55,
      east: 104.92,
      west: 104.87,
    },
    invalid: false,
  });
});

test("rejects partial, inverted, and out-of-range map state safely", () => {
  assert.equal(
    parseSearchMapState({ north: "11.59", south: "11.55" }).invalid,
    true,
  );
  assert.equal(
    parseSearchMapState({
      north: "11.55",
      south: "11.59",
      east: "104.92",
      west: "104.87",
    }).invalid,
    true,
  );
  assert.equal(parseSearchMapState({ page: "10001" }).invalid, true);
});

test("writes and clears shareable viewport and pagination state", () => {
  const href = buildSearchMapHref("?institution=rupp&maxRentUsd=200&page=7", {
    page: 2,
    viewport: {
      north: 11.590006,
      south: 11.550006,
      east: 104.920006,
      west: 104.870006,
    },
  });
  const url = new URL(href, "https://findme.test");
  assert.equal(url.searchParams.get("institution"), "rupp");
  assert.equal(url.searchParams.get("maxRentUsd"), "200");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("north"), "11.59001");

  const cleared = new URL(
    buildSearchMapHref(url.search, { page: 1, viewport: null }),
    "https://findme.test",
  );
  assert.equal(cleared.searchParams.has("page"), false);
  assert.equal(cleared.searchParams.has("north"), false);
  assert.equal(cleared.searchParams.get("institution"), "rupp");
});

test("compares normalized map bounds without request churn", () => {
  const first = {
    north: 11.590004,
    south: 11.550004,
    east: 104.920004,
    west: 104.870004,
  };
  const second = normalizeSearchViewport({
    north: 11.590003,
    south: 11.550003,
    east: 104.920003,
    west: 104.870003,
  });
  assert.equal(searchViewportsEqual(first, second), true);
  assert.equal(searchViewportsEqual(first, null), false);
});
