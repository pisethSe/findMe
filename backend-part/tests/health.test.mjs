import assert from "node:assert/strict";
import test from "node:test";

import { HealthService } from "../dist/modules/health/health.service.js";

test("reports the API process as live", () => {
  const service = new HealthService({});

  assert.deepEqual(service.getLiveness(), {
    data: {
      status: "ok",
      service: "findme-api",
    },
  });
});

test("reports readiness only after a successful database query", async () => {
  const healthyService = new HealthService({
    $queryRaw: async () => [{ "?column?": 1 }],
  });
  assert.deepEqual(await healthyService.getReadiness(), {
    data: { status: "ok", service: "findme-api" },
  });

  const unavailableService = new HealthService({
    $queryRaw: async () => {
      throw new Error("connection refused");
    },
  });
  await assert.rejects(
    unavailableService.getReadiness(),
    (error) => error.getResponse().code === "DATABASE_UNAVAILABLE",
  );
});
