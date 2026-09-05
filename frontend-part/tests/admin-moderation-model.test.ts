import assert from "node:assert/strict";
import test from "node:test";

import {
  MODERATION_PAGE_SIZE,
  pageAfterModerationDecision,
} from "../src/features/admin/admin-moderation-model.ts";

test("moderation pagination does not strand an Admin on an empty later page", () => {
  assert.equal(MODERATION_PAGE_SIZE, 20);
  assert.equal(pageAfterModerationDecision(3, 1), 2);
  assert.equal(pageAfterModerationDecision(3, 2), 3);
  assert.equal(pageAfterModerationDecision(1, 1), 1);
});
