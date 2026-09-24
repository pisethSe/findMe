import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateAvailability,
  hasCurrentAvailability,
  publicListingWhere,
} from "../dist/modules/listings/availability-policy.js";
import { DiscoveryService } from "../dist/modules/discovery/discovery.service.js";

test("availability reminders and expiry use elapsed server time, including exact boundaries", () => {
  const confirmed = new Date("2026-09-01T00:00:00Z");
  for (const [elapsed, expected] of [
    [0, "FRESH"],
    [7 * 86400000 - 1, "FRESH"],
    [7 * 86400000, "DUE"],
    [14 * 86400000 - 1, "DUE"],
    [14 * 86400000, "STALE"],
    [30 * 86400000, "STALE"],
  ]) {
    const now = new Date(confirmed.getTime() + elapsed);
    const value = evaluateAvailability(confirmed, now);
    assert.equal(value.state, expected);
    assert.equal(value.remindAt, "2026-09-08T00:00:00.000Z");
    assert.equal(value.expiresAt, "2026-09-15T00:00:00.000Z");
    assert.equal(
      hasCurrentAvailability(confirmed, now),
      ["FRESH", "DUE"].includes(expected),
    );
  }
  for (const invalid of [
    null,
    new Date(NaN),
    new Date(confirmed.getTime() + 1),
  ]) {
    assert.equal(evaluateAvailability(invalid, confirmed).state, "UNCONFIRMED");
    assert.equal(hasCurrentAvailability(invalid, confirmed), false);
  }
  assert.deepEqual(
    publicListingWhere(new Date("2026-09-15T00:00:00Z"))
      .availabilityConfirmedAt,
    {
      gt: confirmed,
      lte: new Date("2026-09-15T00:00:00Z"),
    },
  );
});

test("a cached card that crosses its availability deadline forces a fresh search and total", async () => {
  let reads = 0;
  let writes = 0;
  const cached = {
    data: [
      {
        availabilityConfirmedAt: new Date(
          Date.now() - 14 * 86400000,
        ).toISOString(),
      },
    ],
    meta: { total: 1 },
  };
  const service = new DiscoveryService(
    {
      findInstitution: async () => ({
        id: "school",
        latitude: 11.5,
        longitude: 104.9,
      }),
      search: async () => {
        reads++;
        return { records: [], total: 0 };
      },
    },
    {
      getSearch: async () => ({ generation: "1", value: cached }),
      setSearch: async () => {
        writes++;
      },
    },
    { recordRead: async () => {} },
  );
  const result = await service.search({ institutionId: "school" });
  assert.deepEqual(result.data, []);
  assert.equal(result.meta.total, 0);
  assert.equal(reads, 1);
  assert.equal(writes, 1);
});
