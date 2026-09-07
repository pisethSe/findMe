import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSearchRadius,
  isSearchRadius,
  nextSearchRadius,
  parseDistanceFilter,
  radiusFromKilometres,
  SEARCH_RADIUS_PRESETS_METERS,
} from "../src/features/search/distance-filter-model.ts";

test("distance URLs default to 5 km and convert decimal kilometres to exact integer metres", () => {
  assert.deepEqual(parseDistanceFilter(undefined), {
    radiusMeters: 5_000,
    invalid: false,
  });
  for (const [input, expected] of [
    ["0.1", 100],
    [".1", 100],
    ["0.101", 101],
    ["1.001", 1_001],
    [" 2.500 ", 2_500],
    ["19.999", 19_999],
    ["20", 20_000],
  ] as const) {
    assert.equal(radiusFromKilometres(input), expected, input);
    assert.deepEqual(parseDistanceFilter(input), {
      radiusMeters: expected,
      invalid: false,
    });
  }
});

test("invalid and ambiguous shared distances warn and fall back without sending invalid API radii", () => {
  for (const input of [
    "",
    " ",
    "0",
    "-1",
    "0.001",
    "0.099",
    "20.001",
    "9999999",
    "Infinity",
    "NaN",
    "1e1",
    "0x10",
    "1,5",
    ".",
    "1.0001",
    "5 km",
    ["1", "20"],
    ["5"],
    [],
  ]) {
    assert.deepEqual(
      parseDistanceFilter(input),
      { radiusMeters: 5_000, invalid: true },
      String(input),
    );
  }
});

test("every supported API radius survives a shareable kilometre round trip", () => {
  for (let radiusMeters = 100; radiusMeters <= 20_000; radiusMeters += 1) {
    assert.equal(
      radiusFromKilometres(String(radiusMeters / 1_000)),
      radiusMeters,
    );
  }
  for (const value of [99, 20_001, 100.5, NaN, Infinity, "100", null]) {
    assert.equal(isSearchRadius(value), false);
  }
});

test("presets widen to the next supported distance and stop at 20 km", () => {
  assert.equal(nextSearchRadius(100), 1_000);
  assert.equal(nextSearchRadius(2_500), 3_000);
  SEARCH_RADIUS_PRESETS_METERS.forEach((radius, index) => {
    assert.equal(
      nextSearchRadius(radius),
      SEARCH_RADIUS_PRESETS_METERS[index + 1] ?? null,
    );
    assert.equal(isSearchRadius(radius), true);
  });
  assert.equal(formatSearchRadius(100), "0.1 km");
  assert.equal(formatSearchRadius(1_001), "1.001 km");
  assert.equal(formatSearchRadius(20_000), "20 km");
});
