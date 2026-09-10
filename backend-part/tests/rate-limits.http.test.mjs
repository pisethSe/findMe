import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Module, UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ApiExceptionFilter } from "../dist/common/http/api-exception.filter.js";
import { getTrustedProxyCidrs } from "../dist/config/environment.js";
import { RateLimitsModule } from "../dist/modules/rate-limits/rate-limits.module.js";
import { AuthController } from "../dist/modules/auth/auth.controller.js";
import { AuthService } from "../dist/modules/auth/auth.service.js";
import { AccessTokenGuard } from "../dist/modules/auth/access-token.guard.js";
import { RolesGuard } from "../dist/modules/auth/roles.guard.js";
import { DiscoveryController } from "../dist/modules/discovery/discovery.controller.js";
import { DiscoveryService } from "../dist/modules/discovery/discovery.service.js";
import { ListingDetailService } from "../dist/modules/discovery/listing-detail.service.js";
import { MediaController } from "../dist/modules/media/media.controller.js";
import { MediaService } from "../dist/modules/media/media.service.js";
import { ModerationController } from "../dist/modules/moderation/moderation.controller.js";
import { ModerationService } from "../dist/modules/moderation/moderation.service.js";
import { AdminController } from "../dist/modules/admin/admin.controller.js";
import { AdminService } from "../dist/modules/admin/admin.service.js";
import { CatalogController } from "../dist/modules/admin/catalog.controller.js";
import { CatalogService } from "../dist/modules/admin/catalog.service.js";
import { StudentInquiriesController } from "../dist/modules/inquiries/inquiries.controller.js";
import { InquiriesService } from "../dist/modules/inquiries/inquiries.service.js";
import { ReportsController } from "../dist/modules/reports/reports.controller.js";
import { ReportsService } from "../dist/modules/reports/reports.service.js";

// Actual controllers, guards, interceptor, DTO validation and error serialization.
// Only domain services are substituted, to prove throttling happens before their
// side effects without requiring credentials, database or object storage.
async function start({ trusted = false, mode = "test" } = {}) {
  const previous = {
    APP_ENV: process.env.APP_ENV,
    REDIS_URL: process.env.REDIS_URL,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  };
  process.env.APP_ENV = mode;
  process.env.REDIS_URL = mode === "production" ? "redis://127.0.0.1:6398" : "";
  process.env.REFRESH_TOKEN_SECRET =
    "test-rate-limit-secret-at-least-32-characters";
  const calls = [];
  const principals = new Map([
    ["student", { id: randomUUID(), role: "STUDENT" }],
    ["landlord", { id: randomUUID(), role: "LANDLORD" }],
    ["other-landlord", { id: randomUUID(), role: "LANDLORD" }],
    ["admin", { id: randomUUID(), role: "ADMIN" }],
  ]);
  const record =
    (name) =>
    (...args) => {
      calls.push({ name, args });
      return { id: randomUUID() };
    };
  const auth = {
    authenticateAccessToken: async (token) => {
      const principal = principals.get(token);
      if (!principal) throw new UnauthorizedException();
      return principal;
    },
    login: async () => {
      calls.push({ name: "login" });
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid credentials.",
      });
    },
    requestPasswordReset: async () => ({ accepted: true }),
    logout: async () => undefined,
  };
  class HttpTestModule {}
  Module({
    imports: [RateLimitsModule],
    controllers: [
      AuthController,
      DiscoveryController,
      MediaController,
      ModerationController,
      AdminController,
      CatalogController,
      StudentInquiriesController,
      ReportsController,
    ],
    providers: [
      AccessTokenGuard,
      RolesGuard,
      { provide: AuthService, useValue: auth },
      {
        provide: DiscoveryService,
        useValue: {
          search: record("search"),
          listInstitutions: record("institutions"),
        },
      },
      { provide: ListingDetailService, useValue: { detail: record("detail") } },
      {
        provide: MediaService,
        useValue: {
          createUploadIntent: record("upload"),
          finalize: record("finalize"),
        },
      },
      {
        provide: ModerationService,
        useValue: {
          approve: record("approve"),
          reject: record("reject"),
          listPending: record("pending"),
        },
      },
      {
        provide: AdminService,
        useValue: {
          setUserStatus: record("userStatus"),
          updateReport: record("reportStatus"),
          removeListing: record("removeListing"),
        },
      },
      {
        provide: CatalogService,
        useValue: {
          institution: record("institution"),
          amenity: record("amenity"),
        },
      },
      { provide: InquiriesService, useValue: { create: record("inquiry") } },
      { provide: ReportsService, useValue: { create: record("report") } },
    ],
  })(HttpTestModule);
  const app = await NestFactory.create(HttpTestModule, { logger: false });
  app.set(
    "trust proxy",
    trusted ? getTrustedProxyCidrs("127.0.0.1,::1") : false,
  );
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api/v1`;
  return {
    calls,
    principals,
    async request(path, { method = "POST", token, body, ip, headers } = {}) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
          ...(ip ? { "x-forwarded-for": ip } : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return {
        status: response.status,
        headers: response.headers,
        body: response.status === 204 ? null : await response.json(),
      };
    },
    async close() {
      await app.close();
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    },
  };
}

function assertLimited(result) {
  assert.equal(result.status, 429, JSON.stringify(result.body));
  assert.equal(result.body.error.code, "RATE_LIMITED");
  assert.ok(result.body.error.retryAfterSeconds > 0);
  assert.equal(
    Number(result.headers.get("retry-after")),
    result.body.error.retryAfterSeconds,
  );
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  assert.equal(result.body.error.requestId, result.headers.get("x-request-id"));
  assert.doesNotMatch(
    JSON.stringify(result.body),
    /findme:v1|request-limit|Bearer|127\.0\.0\.1|@example/,
  );
}

test("HTTP budgets include invalid inputs, ignore spoofed IPs and keep auth policies separate", async () => {
  const api = await start();
  try {
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await api.request("/auth/register", {
            body: {},
            ip: `192.0.2.${i + 1}`,
          })
        ).status,
        400,
      );
    assertLimited(
      await api.request("/auth/register", {
        body: {},
        ip: "203.0.113.1",
        headers: { forwarded: "for=203.0.113.2", "x-real-ip": "203.0.113.3" },
      }),
    );
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await api.request("/auth/login", {
            body: { email: "Dara@example.test", password: "incorrect" },
          })
        ).status,
        401,
      );
    assertLimited(
      await api.request("/auth/login", {
        body: { email: "dara@EXAMPLE.test", password: "incorrect" },
      }),
    );
    assert.equal(api.calls.filter((call) => call.name === "login").length, 10);
    assert.equal(
      (
        await api.request("/auth/login", {
          body: { email: "other@example.test", password: "incorrect" },
        })
      ).status,
      401,
    );
    for (let i = 0; i < 3; i++)
      assert.equal(
        (
          await api.request("/auth/forgot-password", {
            body: { email: "unknown@example.test" },
          })
        ).status,
        202,
      );
    assertLimited(
      await api.request("/auth/forgot-password", {
        body: { email: "UNKNOWN@example.test" },
      }),
    );
    assert.equal((await api.request("/auth/logout")).status, 204);
  } finally {
    await api.close();
  }
});

test("trusted proxy chains use the nearest untrusted client; email budgets span networks", async () => {
  const api = await start({ trusted: true });
  try {
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await api.request("/auth/login", {
            body: { email: "dara@example.test", password: "incorrect" },
            ip: `192.0.2.${i + 1}`,
          })
        ).status,
        401,
      );
    assertLimited(
      await api.request("/auth/login", {
        body: { email: "DARA@example.test", password: "incorrect" },
        ip: "198.51.100.1",
      }),
    );
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await api.request("/auth/register", {
            body: {},
            ip: `192.0.2.${i + 1}, 198.51.100.2`,
          })
        ).status,
        400,
      );
    assertLimited(
      await api.request("/auth/register", {
        body: {},
        ip: "203.0.113.9, 198.51.100.2",
      }),
    );
    assert.equal(
      (await api.request("/auth/register", { body: {}, ip: "198.51.100.3" }))
        .status,
      400,
    );
  } finally {
    await api.close();
  }
});

test("search query variation cannot evade the shared budget and throttled catalog responses are never public-cacheable", async () => {
  const api = await start();
  try {
    const institutionId = randomUUID();
    for (let i = 0; i < 120; i++)
      assert.equal(
        (
          await api.request(
            `/listings/search?institutionId=${institutionId}&radiusMeters=${100 + i}`,
            { method: "GET" },
          )
        ).status,
        200,
      );
    assertLimited(
      await api.request(`/listings/search?institutionId=${randomUUID()}`, {
        method: "GET",
      }),
    );
    assert.equal(
      api.calls.filter((call) => call.name === "search").length,
      120,
    );
    for (let i = 0; i < 240; i++)
      assert.equal(
        (await api.request("/institutions", { method: "GET" })).status,
        200,
      );
    assertLimited(await api.request("/institutions", { method: "GET" }));
    assert.equal(
      (await api.request("/listings/a-valid-slug", { method: "GET" })).status,
      200,
    );
  } finally {
    await api.close();
  }
});

test("uploads use authenticated account budgets across IPs and reject requests before storage work", async () => {
  const api = await start({ trusted: true });
  const body = {
    listingId: randomUUID(),
    contentType: "image/jpeg",
    sizeBytes: 100,
    sortOrder: 0,
  };
  try {
    assert.equal(
      (await api.request("/media/upload-intents", { body })).status,
      401,
    );
    assert.equal(
      (await api.request("/media/upload-intents", { body, token: "student" }))
        .status,
      403,
    );
    for (let i = 0; i < 30; i++)
      assert.equal(
        (
          await api.request("/media/upload-intents", {
            body,
            token: "landlord",
            ip: `192.0.2.${i + 1}`,
          })
        ).status,
        201,
      );
    assertLimited(
      await api.request("/media/upload-intents", {
        body: { ...body, landlordId: "forged" },
        token: "landlord",
        ip: "198.51.100.1",
      }),
    );
    assert.equal(api.calls.filter((call) => call.name === "upload").length, 30);
    assert.ok(
      api.calls
        .filter((call) => call.name === "upload")
        .every((call) => call.args[0] === api.principals.get("landlord").id),
    );
    assert.equal(
      (
        await api.request("/media/upload-intents", {
          body,
          token: "other-landlord",
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await api.request(`/media/${randomUUID()}/finalize`, {
          body: {},
          token: "landlord",
        })
      ).status,
      200,
    );
  } finally {
    await api.close();
  }
});

test("all sensitive admin mutations share the account budget while moderation reads remain available", async () => {
  const api = await start();
  try {
    const id = randomUUID();
    assert.equal(
      (await api.request(`/admin/listings/${id}/approve`, { token: "student" }))
        .status,
      403,
    );
    for (let i = 0; i < 30; i++)
      assert.equal(
        (
          await api.request(`/admin/listings/${randomUUID()}/approve`, {
            token: "admin",
          })
        ).status,
        200,
      );
    for (const [method, path] of [
      ["POST", `/admin/listings/${id}/approve`],
      ["POST", `/admin/listings/${id}/reject`],
      ["POST", `/admin/listings/${id}/pause`],
      ["POST", `/admin/listings/${id}/archive`],
      ["POST", `/admin/users/${id}/suspend`],
      ["POST", `/admin/users/${id}/reactivate`],
      ["PATCH", `/admin/reports/${id}`],
      ["POST", "/admin/institutions"],
      ["PATCH", `/admin/institutions/${id}`],
      ["POST", "/admin/amenities"],
      ["PATCH", `/admin/amenities/${id}`],
    ])
      assertLimited(
        await api.request(path, { method, body: {}, token: "admin" }),
      );
    assert.equal(api.calls.length, 30);
    assert.equal(
      (
        await api.request("/admin/listings/pending", {
          method: "GET",
          token: "admin",
        })
      ).status,
      200,
    );
  } finally {
    await api.close();
  }
});

test("inquiry and report request budgets bound retries separately from domain submission limits", async () => {
  const api = await start();
  try {
    for (let i = 0; i < 60; i++)
      assert.equal(
        (
          await api.request(`/listings/${randomUUID()}/inquiries`, {
            token: "student",
            body: {
              message: "Is this room available?",
              clientRequestId: randomUUID(),
            },
          })
        ).status,
        201,
      );
    assertLimited(
      await api.request(`/listings/${randomUUID()}/inquiries`, {
        token: "student",
        body: {},
      }),
    );
    for (let i = 0; i < 30; i++)
      assert.equal(
        (
          await api.request(`/listings/${randomUUID()}/reports`, {
            token: "student",
            body: { reason: "INACCURATE" },
          })
        ).status,
        201,
      );
    assertLimited(
      await api.request(`/listings/${randomUUID()}/reports`, {
        token: "student",
        body: {},
      }),
    );
    assert.equal(
      api.calls.filter((call) => call.name === "inquiry").length,
      60,
    );
    assert.equal(api.calls.filter((call) => call.name === "report").length, 30);
  } finally {
    await api.close();
  }
});

test("deployed Redis outage returns retryable 503 without sensitive side effects or blocking discovery", async () => {
  const api = await start({ mode: "production" });
  try {
    for (const path of [
      "/auth/login",
      "/auth/register",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/refresh",
      "/media/upload-intents",
      `/media/${randomUUID()}/finalize`,
      `/admin/listings/${randomUUID()}/approve`,
    ]) {
      const result = await api.request(path, { token: "admin", body: {} });
      assert.equal(result.status, 503);
      assert.equal(result.body.error.code, "RATE_LIMIT_UNAVAILABLE");
      assert.equal(result.headers.get("retry-after"), "30");
      assert.equal(result.headers.get("cache-control"), "private, no-store");
    }
    assert.equal(api.calls.length, 0);
    assert.equal(
      (await api.request("/institutions", { method: "GET" })).status,
      200,
    );
    assert.equal((await api.request("/auth/logout")).status, 204);
  } finally {
    await api.close();
  }
});
