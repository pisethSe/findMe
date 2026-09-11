import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { Module, UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AnalyticsController } from "../dist/modules/analytics/analytics.controller.js";
import { AnalyticsService } from "../dist/modules/analytics/analytics.service.js";
import { AuthService } from "../dist/modules/auth/auth.service.js";
import { AccessTokenGuard } from "../dist/modules/auth/access-token.guard.js";
import { RolesGuard } from "../dist/modules/auth/roles.guard.js";
import { RateLimitsModule } from "../dist/modules/rate-limits/rate-limits.module.js";
import { ApiExceptionFilter } from "../dist/common/http/api-exception.filter.js";

test("analytics summary is admin-only, validated, private, bounded and rate-limited", async () => {
  const previous = {
    APP_ENV: process.env.APP_ENV,
    REDIS_URL: process.env.REDIS_URL,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  };
  process.env.APP_ENV = "test";
  process.env.REDIS_URL = "";
  process.env.REFRESH_TOKEN_SECRET =
    "analytics-test-rate-limit-secret-32-characters";
  let reads = 0;
  const service = new AnalyticsService({
    summary: async () => {
      reads++;
      return [];
    },
  });
  class HttpModule {}
  Module({
    imports: [RateLimitsModule],
    controllers: [AnalyticsController],
    providers: [
      AccessTokenGuard,
      RolesGuard,
      { provide: AnalyticsService, useValue: service },
      {
        provide: AuthService,
        useValue: {
          authenticateAccessToken: async (token) => {
            if (!["STUDENT", "LANDLORD", "ADMIN"].includes(token))
              throw new UnauthorizedException();
            return {
              id: token.toLowerCase(),
              role: token,
              onboardingComplete: true,
            };
          },
        },
      },
    ],
  })(HttpModule);
  const app = await NestFactory.create(HttpModule, { logger: false });
  try {
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.listen(0, "127.0.0.1");
    const base = `${await app.getUrl()}/api/v1/admin/analytics/summary`;
    const request = (role, query = "from=2026-09-01&to=2026-09-30") =>
      fetch(`${base}?${query}`, {
        headers: role ? { authorization: `Bearer ${role}` } : {},
      });
    for (const [role, status] of [
      [null, 401],
      ["invalid", 401],
      ["STUDENT", 403],
      ["LANDLORD", 403],
    ]) {
      assert.equal((await request(role)).status, status);
    }
    assert.equal(reads, 0);
    for (const query of [
      "",
      "from=2026-02-30&to=2026-03-01",
      "from=2026-09-02&to=2026-09-01",
      "from=2026-09-01&to=2026-10-02",
      "from=2026-09-01&to=2026-09-01&userId=private",
    ]) {
      assert.equal((await request("ADMIN", query)).status, 400);
    }
    assert.equal(reads, 0);
    const success = await request("ADMIN");
    assert.equal(success.status, 200);
    assert.equal(success.headers.get("cache-control"), "private, no-store");
    const body = await success.json();
    assert.equal(body.meta.days, 30);
    assert.ok(body.data.totals.every((row) => row.count === "0"));
    assert.equal(reads, 1);
    let limited;
    for (let i = 0; i < 31; i++) {
      limited = await request("ADMIN");
      if (limited.status === 429) break;
    }
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
    assert.equal(
      (
        await fetch(base, {
          method: "POST",
          headers: {
            authorization: "Bearer ADMIN",
            "content-type": "application/json",
          },
          body: JSON.stringify({ event: "INQUIRY_CREATED", userId: "forged" }),
        })
      ).status,
      404,
    );
  } finally {
    await app.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
