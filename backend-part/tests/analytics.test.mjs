import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { AnalyticsSummaryQueryDto } from "../dist/modules/analytics/analytics.dto.js";
import { AnalyticsService } from "../dist/modules/analytics/analytics.service.js";
import { ANALYTICS_EVENTS } from "../dist/modules/analytics/analytics.events.js";
import { DiscoveryService } from "../dist/modules/discovery/discovery.service.js";
import { ListingDetailService } from "../dist/modules/discovery/listing-detail.service.js";

test("analytics dates reject impossible dates, timestamps, arrays, and extra/private fields", () => {
  const valid = { from: "2026-09-01", to: "2026-09-30" };
  for (const extra of [
    { from: "2026-02-30" },
    { from: "0000-01-01" },
    { to: "2026-09-01T00:00:00Z" },
    { from: ["2026-09-01"] },
    { from: null },
    { userId: "private" },
    { latitude: 11.56 },
    { event: "FAKE" },
  ]) {
    assert.ok(
      validateSync(
        plainToInstance(AnalyticsSummaryQueryDto, { ...valid, ...extra }),
        {
          whitelist: true,
          forbidNonWhitelisted: true,
        },
      ).length,
    );
  }
  assert.equal(
    validateSync(plainToInstance(AnalyticsSummaryQueryDto, valid)).length,
    0,
  );
});

test("summary has explicit empty days, exact bigint totals and bounded inclusive ranges", async () => {
  let calls = 0;
  const service = new AnalyticsService({
    summary: async (from, to) => {
      calls++;
      assert.equal(from.toISOString(), "2026-09-01T00:00:00.000Z");
      assert.equal(to.toISOString(), "2026-09-02T00:00:00.000Z");
      return [
        { day: from, event: "INQUIRY_CREATED", count: 9007199254740993n },
      ];
    },
  });
  for (const range of [
    { from: "2026-09-02", to: "2026-09-01" },
    { from: "2026-09-01", to: "2026-10-02" },
  ])
    await assert.rejects(
      service.summary(range),
      (e) => e.getResponse().code === "ANALYTICS_DATE_RANGE_INVALID",
    );
  assert.equal(calls, 0);
  const result = await service.summary({
    from: "2026-09-01",
    to: "2026-09-02",
  });
  assert.equal(
    result.data.totals.find((row) => row.event === "INQUIRY_CREATED").count,
    "9007199254740993",
  );
  assert.equal(result.data.daily.length, 2);
  assert.equal(result.data.daily[1].events.length, ANALYTICS_EVENTS.length);
  assert.ok(result.data.daily[1].events.every((row) => row.count === "0"));
  assert.equal(result.meta.timezone, "UTC");
  assert.doesNotThrow(() => JSON.stringify(result));
  await assert.rejects(
    new AnalyticsService({
      summary: async () => {
        throw new Error("unavailable");
      },
    }).summary({ from: "2026-09-01", to: "2026-09-01" }),
  );
});

test("read telemetry failure is visible but cannot fail discovery; cooldown bounds retries", async () => {
  let writes = 0;
  const warnings = [];
  const analytics = new AnalyticsService({
    recordRead: async () => {
      writes++;
      throw new Error("postgresql://private-secret@host private query");
    },
  });
  analytics.logger = { warn: (message) => warnings.push(message) };
  await analytics.recordRead(["SEARCH_RESPONSE"]);
  await analytics.recordRead(["LISTING_DETAIL_RESPONSE"]);
  assert.equal(writes, 1);
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(warnings[0], /private|postgresql/);
  analytics.retryAfter = 0;
  await analytics.recordRead(["SEARCH_RESPONSE"]);
  assert.equal(writes, 2);
});

test("cached and uncached search count successes, zero totals, and exclude invalid/failed requests", async () => {
  const events = [];
  const institution = { id: "institution", latitude: 11.5, longitude: 104.9 };
  let total = 0;
  let cached = null;
  let fail = false;
  const service = new DiscoveryService(
    {
      findInstitution: async (id) =>
        id === "institution" ? institution : null,
      search: async () => {
        if (fail) throw new Error("query failed");
        return { records: [], total };
      },
    },
    {
      getSearch: async () => ({ value: cached, generation: "1" }),
      setSearch: async () => undefined,
    },
    { recordRead: async (names) => events.push(names) },
  );
  const query = { institutionId: "institution" };
  await service.search(query);
  total = 10;
  // An empty out-of-range page is not a zero-result search.
  await service.search({ ...query, page: 9 });
  cached = { data: [], meta: { total: 0 } };
  await service.search(query);
  cached = { data: [], meta: { total: 4 } };
  await service.search(query);
  cached = null;
  fail = true;
  await assert.rejects(service.search(query));
  await assert.rejects(service.search({ institutionId: "missing" }));
  await assert.rejects(service.search({ ...query, minPrice: 10 }));
  assert.deepEqual(events, [
    ["SEARCH_RESPONSE", "SEARCH_ZERO_RESULTS"],
    ["SEARCH_RESPONSE"],
    ["SEARCH_RESPONSE", "SEARCH_ZERO_RESULTS"],
    ["SEARCH_RESPONSE"],
  ]);
});

test("missing/private rental details and invalid institution context produce no read event", async () => {
  const events = [];
  let record = null;
  const service = new ListingDetailService(
    { findPublic: async () => record },
    {
      findInstitution: async () => null,
    },
    { recordRead: async (names) => events.push(names) },
  );
  await assert.rejects(service.detail("private-rental"));
  record = { distanceMeters: null };
  await assert.rejects(service.detail("public-rental", "missing-institution"));
  assert.deepEqual(events, []);
});
