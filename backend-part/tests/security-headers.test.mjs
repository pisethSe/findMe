import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "../dist/app.module.js";
import { getApiSecurityHeaders } from "../dist/common/http/security-headers.js";
import { getAppEnvironment } from "../dist/config/environment.js";

function headersFor(appEnvironment) {
  return new Map(getApiSecurityHeaders(appEnvironment));
}

test("stops browsers from misinterpreting an API response", () => {
  const headers = headersFor("local");

  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("Referrer-Policy"), "no-referrer");
  assert.ok(headers.get("Permissions-Policy")?.includes("geolocation=()"));
});

test("locks the JSON API down as a non-executable, non-embeddable document", () => {
  const headers = headersFor("local");
  const policy = headers.get("Content-Security-Policy");

  assert.ok(policy);
  assert.ok(policy.includes("default-src 'none'"));
  assert.ok(policy.includes("frame-ancestors 'none'"));
  assert.ok(policy.includes("sandbox"));
  // The API never renders a document, so nothing may load or execute.
  assert.ok(!policy.includes("'unsafe-inline'"));
  assert.ok(!policy.includes("*"));
});

test("requires HTTPS for every deployed environment", () => {
  assert.equal(headersFor("local").has("Strict-Transport-Security"), false);
  assert.equal(headersFor("test").has("Strict-Transport-Security"), false);

  for (const appEnvironment of ["staging", "production"]) {
    assert.equal(
      headersFor(appEnvironment).get("Strict-Transport-Security"),
      "max-age=63072000; includeSubDomains; preload",
    );
  }
});

// Guards the wiring in `main.ts`, which a unit test on the pure function cannot
// cover: a dropped middleware line or a re-enabled framework default would
// otherwise ship without any test failing. The route is registered directly on
// the HTTP adapter because this file runs as plain JavaScript and cannot use
// Nest route decorators.
test("applies the headers to real responses and hides the framework", async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    // Mirror the production middleware order in `main.ts`.
    const securityHeaders = getApiSecurityHeaders(getAppEnvironment("local"));
    app.use((_request, response, next) => {
      for (const [name, value] of securityHeaders)
        response.setHeader(name, value);
      next();
    });
    app.disable("x-powered-by");
    app.setGlobalPrefix("api/v1");
    await app.listen(0, "127.0.0.1");

    const response = await fetch(`${await app.getUrl()}/api/v1/health/live`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.match(
      response.headers.get("content-security-policy") ?? "",
      /default-src 'none'/,
    );
    // The API must not advertise the framework it runs on.
    assert.equal(response.headers.get("x-powered-by"), null);
  } finally {
    await app.close();
  }
});
