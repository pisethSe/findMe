import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { ApiExceptionFilter } from "../dist/common/http/api-exception.filter.js";
import { MetricsService } from "../dist/common/observability/metrics.service.js";
import { OpsController } from "../dist/modules/health/ops.controller.js";
import { OpsTokenGuard } from "../dist/modules/health/ops-token.guard.js";

const TOKEN = "ops-metrics-token-with-at-least-32-characters";
const OTHER_TOKEN = "different-ops-token-with-at-least-32-chars";

test("the ops metrics route is private, invisible when unset, and bounded", async () => {
  const previous = process.env.OPS_METRICS_TOKEN;
  class HttpModule {}
  Module({
    controllers: [OpsController],
    providers: [MetricsService, OpsTokenGuard],
  })(HttpModule);

  const app = await NestFactory.create(HttpModule, { logger: false });
  try {
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.listen(0, "127.0.0.1");
    const base = `${await app.getUrl()}/api/v1/health/metrics`;

    delete process.env.OPS_METRICS_TOKEN;
    const hidden = await fetch(base);
    assert.equal(hidden.status, 404);
    assert.equal((await hidden.json()).error.code, "NOT_FOUND");

    process.env.OPS_METRICS_TOKEN = TOKEN;
    const missing = await fetch(base);
    assert.equal(missing.status, 401);
    assert.equal((await missing.json()).error.code, "OPS_TOKEN_REQUIRED");

    const wrong = await fetch(base, {
      headers: { authorization: `Bearer ${OTHER_TOKEN}` },
    });
    assert.equal(wrong.status, 401);
    assert.equal((await wrong.json()).error.code, "OPS_TOKEN_REQUIRED");

    process.env.OPS_METRICS_TOKEN = "short";
    const misconfigured = await fetch(base);
    assert.equal(misconfigured.status, 404);

    process.env.OPS_METRICS_TOKEN = TOKEN;
    app.get(MetricsService).recordHttpRequest({
      method: "GET",
      route: "/api/v1/health/live",
      status: 200,
      durationMs: 4,
    });
    const allowed = await fetch(base, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("cache-control"), "no-store");
    const body = await allowed.json();
    assert.equal(body.data.counters[0].name, "http_requests_total");
    assert.equal(body.data.counters[0].labels.route, "/api/v1/health/live");
    assert.equal(body.data.counters[0].value, 1);
    assert.deepEqual(body.data.droppedSeries, []);
    assert.equal(body.data.histograms[0].labels.route, "/api/v1/health/live");
    assert.doesNotMatch(JSON.stringify(body), new RegExp(TOKEN));
  } finally {
    await app.close();
    if (previous === undefined) delete process.env.OPS_METRICS_TOKEN;
    else process.env.OPS_METRICS_TOKEN = previous;
  }
});
