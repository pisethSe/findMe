import assert from "node:assert/strict";
import test from "node:test";

import {
  canRetryPublishedMap,
  resultScrollBehavior,
  viewAfterResultSelection,
} from "../src/features/search/search-ui-state.ts";

test("mobile result selection hands off between the complete list and map", () => {
  assert.equal(viewAfterResultSelection("card"), "map");
  assert.equal(viewAfterResultSelection("marker"), "list");
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
