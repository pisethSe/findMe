import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SERIES_PER_METRIC,
  MetricsService,
  statusClass,
} from "../dist/common/observability/metrics.service.js";
import { createRequestMetricsMiddleware } from "../dist/common/observability/request-metrics.middleware.js";

function createResponse(statusCode) {
  const listeners = new Map();
  const response = {
    statusCode,
    on(event, listener) {
      listeners.set(event, listener);
      return response;
    },
    finish() {
      listeners.get("finish")?.();
    },
  };
  return response;
}

function createRequest({ method = "GET", baseUrl = "", route } = {}) {
  return { method, baseUrl, route };
}

async function record(request, statusCode, metrics) {
  const middleware = createRequestMetricsMiddleware(metrics);
  const response = createResponse(statusCode);
  await new Promise((resolve) => middleware(request, response, resolve));
  response.finish();
}

test("counters aggregate one series per label set regardless of key order", () => {
  const metrics = new MetricsService();
  metrics.incrementCounter("cache_events_total", {
    result: "hit",
    scope: "search",
  });
  metrics.incrementCounter("cache_events_total", {
    scope: "search",
    result: "hit",
  });
  metrics.incrementCounter("cache_events_total", {
    result: "miss",
    scope: "search",
  });

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.counters.length, 2);
  const hit = snapshot.counters.find((entry) => entry.labels.result === "hit");
  assert.equal(hit.value, 2);
  assert.deepEqual(hit.labels, { result: "hit", scope: "search" });
});

test("durations produce cumulative buckets with count and sum", () => {
  const metrics = new MetricsService();
  metrics.observeMilliseconds("db_query_duration_ms", 3);
  metrics.observeMilliseconds("db_query_duration_ms", 40);
  metrics.observeMilliseconds("db_query_duration_ms", 9000);

  const [histogram] = metrics.snapshot().histograms;
  assert.equal(histogram.count, 3);
  assert.equal(histogram.sum, 9043);
  const bucket = (bound) =>
    histogram.buckets.find((entry) => entry.lessThanOrEqual === bound).count;
  assert.equal(bucket(5), 1);
  assert.equal(bucket(10), 1);
  assert.equal(bucket(50), 2);
  assert.equal(bucket(5000), 2);
  assert.deepEqual(histogram.buckets.at(-1), {
    lessThanOrEqual: "Infinity",
    count: 3,
  });
});

test("status codes map to stable classes", () => {
  assert.equal(statusClass(100), "1xx");
  assert.equal(statusClass(204), "2xx");
  assert.equal(statusClass(304), "3xx");
  assert.equal(statusClass(404), "4xx");
  assert.equal(statusClass(503), "5xx");
});

test("series cardinality is capped and overflow is reported", () => {
  const metrics = new MetricsService();
  for (let index = 0; index < MAX_SERIES_PER_METRIC + 5; index += 1) {
    metrics.incrementCounter("http_requests_total", {
      route: `/route-${index}`,
    });
  }

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.counters.length, MAX_SERIES_PER_METRIC);
  assert.deepEqual(snapshot.droppedSeries, [
    { name: "http_requests_total", dropped: 5 },
  ]);
});

test("completed responses record bounded route and status-class series", async () => {
  const metrics = new MetricsService();
  await record(
    createRequest({ baseUrl: "/api/v1/listings", route: { path: "/:slug" } }),
    200,
    metrics,
  );

  const snapshot = metrics.snapshot();
  const counter = snapshot.counters.find(
    (entry) => entry.name === "http_requests_total",
  );
  assert.deepEqual(counter.labels, {
    method: "GET",
    route: "/api/v1/listings/:slug",
    statusClass: "2xx",
  });
  assert.equal(counter.value, 1);

  const histogram = snapshot.histograms.find(
    (entry) => entry.name === "http_request_duration_ms",
  );
  assert.equal(histogram.labels.route, "/api/v1/listings/:slug");
  assert.equal(histogram.count, 1);
  assert.ok(histogram.sum >= 0);
});

test("unmatched requests share a single metric series", async () => {
  const metrics = new MetricsService();
  for (const baseUrl of ["/api/v1/a", "/api/v1/b", "/api/v1/c"]) {
    await record(createRequest({ baseUrl }), 404, metrics);
  }

  const counters = metrics
    .snapshot()
    .counters.filter((entry) => entry.name === "http_requests_total");
  assert.equal(counters.length, 1);
  assert.equal(counters[0].labels.route, "unmatched");
  assert.equal(counters[0].labels.statusClass, "4xx");
  assert.equal(counters[0].value, 3);
});
