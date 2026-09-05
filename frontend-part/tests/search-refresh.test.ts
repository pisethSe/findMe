import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldRefreshVisibleSearch,
  VISIBLE_SEARCH_REFRESH_MS,
} from "../src/features/search/search-refresh.ts";

test("visible search refresh remains inside the publication freshness target", () => {
  assert.ok(VISIBLE_SEARCH_REFRESH_MS > 0);
  assert.ok(VISIBLE_SEARCH_REFRESH_MS <= 60_000);
  assert.equal(shouldRefreshVisibleSearch("visible"), true);
  assert.equal(shouldRefreshVisibleSearch("hidden"), false);
});
