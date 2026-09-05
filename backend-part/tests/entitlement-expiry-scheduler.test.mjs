import assert from "node:assert/strict";
import test from "node:test";

import { EntitlementExpiryScheduler } from "../dist/modules/entitlements/entitlement-expiry.scheduler.js";

test("entitlement expiry scheduler prevents overlapping retry-safe runs", async () => {
  let releaseSweep;
  let startedSweep;
  const started = new Promise((resolve) => {
    startedSweep = resolve;
  });
  const gate = new Promise((resolve) => {
    releaseSweep = resolve;
  });
  const scheduler = new EntitlementExpiryScheduler({
    sweepExpiredEntitlements: async () => {
      startedSweep();
      await gate;
      return { expiredLandlords: 1, pausedListings: 2 };
    },
  });

  const first = scheduler.runOnce(new Date("2026-09-05T00:00:00.000Z"));
  await started;
  assert.deepEqual(
    await scheduler.runOnce(new Date("2026-09-05T00:00:01.000Z")),
    { expiredLandlords: 0, pausedListings: 0, skipped: true },
  );
  releaseSweep();
  assert.deepEqual(await first, {
    expiredLandlords: 1,
    pausedListings: 2,
    skipped: false,
  });
});
