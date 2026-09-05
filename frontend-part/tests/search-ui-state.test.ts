import assert from "node:assert/strict";
import test from "node:test";

import {
  canRetryPublishedMap,
  MAP_VIEWPORT_DEBOUNCE_MS,
  resultScrollBehavior,
  visibleResultRange,
  viewAfterResultSelection,
} from "../src/features/search/search-ui-state.ts";

test("mobile result selection hands off between the complete list and map", () => {
  assert.equal(viewAfterResultSelection("card"), "map");
  assert.equal(viewAfterResultSelection("marker"), "list");
});

test("map movement waits for a bounded quiet period", () => {
  assert.ok(MAP_VIEWPORT_DEBOUNCE_MS >= 250);
  assert.ok(MAP_VIEWPORT_DEBOUNCE_MS <= 750);
});

test("result ranges stay accurate on full, partial, and empty pages", () => {
  assert.deepEqual(visibleResultRange(1, 12, 29), { first: 1, last: 12 });
  assert.deepEqual(visibleResultRange(3, 12, 29), { first: 25, last: 29 });
  assert.deepEqual(visibleResultRange(1, 12, 0), { first: 0, last: 0 });
});

test("map-to-card movement becomes instant when reduced motion is requested", () => {
  assert.equal(resultScrollBehavior(false), "smooth");
  assert.equal(resultScrollBehavior(true), "auto");
});

test("map failures offer retry only when Maps is configured", () => {
  assert.equal(canRetryPublishedMap(true, "error"), true);
  assert.equal(canRetryPublishedMap(false, "error"), false);
  assert.equal(canRetryPublishedMap(true, "loading"), false);
  assert.equal(canRetryPublishedMap(true, "ready"), false);
});
