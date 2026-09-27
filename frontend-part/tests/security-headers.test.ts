import assert from "node:assert/strict";
import test from "node:test";

import {
  getContentSecurityPolicy,
  getSecurityHeaders,
  validateSecurityHeadersBuildEnvironment,
} from "../src/config/security-headers.ts";

function directive(policy: string, name: string): string | undefined {
  return policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .trim();
}

const localPolicy = getContentSecurityPolicy({ APP_ENV: "local" });

test("denies the highest-risk embedding and injection vectors", () => {
  assert.equal(directive(localPolicy, "default-src"), "'self'");
  assert.equal(directive(localPolicy, "object-src"), "'none'");
  assert.equal(directive(localPolicy, "base-uri"), "'self'");
  assert.equal(directive(localPolicy, "form-action"), "'self'");
  assert.equal(directive(localPolicy, "frame-ancestors"), "'none'");
});

test("allows Google Maps and the campus embed, and nothing else", () => {
  assert.ok(
    directive(localPolicy, "script-src")?.includes(
      "https://maps.googleapis.com",
    ),
  );
  assert.ok(
    directive(localPolicy, "img-src")?.includes("https://maps.gstatic.com"),
  );
  // The campus embed redirects to www.google.com, so both must be framable.
  assert.equal(
    directive(localPolicy, "frame-src"),
    "https://maps.google.com https://www.google.com",
  );
  assert.ok(
    directive(localPolicy, "img-src")?.includes("https://www.google.com"),
  );
});

test("never trusts a wildcard origin", () => {
  for (const name of [
    "default-src",
    "script-src",
    "style-src",
    "img-src",
    "font-src",
    "connect-src",
    "frame-src",
  ]) {
    assert.ok(
      !directive(localPolicy, name)?.includes("*"),
      `${name} must not allow wildcards`,
    );
  }
});

test("permits eval only outside deployed environments", () => {
  // React needs eval() to rebuild server stack traces during development.
  assert.ok(
    directive(
      getContentSecurityPolicy({ APP_ENV: "local" }),
      "script-src",
    )?.includes("'unsafe-eval'"),
  );

  // A deployed build must never ship the relaxation.
  for (const appEnvironment of ["staging", "production"]) {
    assert.ok(
      !directive(
        getContentSecurityPolicy({ APP_ENV: appEnvironment }),
        "script-src",
      )?.includes("'unsafe-eval'"),
      `${appEnvironment} must not allow eval`,
    );
  }
});

test("adds the configured CDN and API origins without trusting malformed values", () => {
  const policy = getContentSecurityPolicy({
    APP_ENV: "production",
    CDN_BASE_URL: "https://media.example.test/findme",
    NEXT_PUBLIC_API_BASE_URL: "https://api.example.test/api/v1",
  });

  assert.ok(
    directive(policy, "img-src")?.includes("https://media.example.test"),
  );
  assert.ok(
    directive(policy, "connect-src")?.includes("https://api.example.test"),
  );
  // A malformed origin is dropped instead of being inserted into the policy.
  const malformed = getContentSecurityPolicy({
    APP_ENV: "production",
    CDN_BASE_URL: "not-a-url",
    NEXT_PUBLIC_API_BASE_URL: "javascript:alert(1)",
  });
  assert.ok(!malformed.includes("not-a-url"));
  assert.ok(!malformed.includes("javascript:"));
});

test("permits blob workers for the WebGL landing ribbon", () => {
  assert.equal(directive(localPolicy, "worker-src"), "'self' blob:");
});

test("sets defensive response headers on every page", () => {
  const headers = new Map(getSecurityHeaders({ APP_ENV: "local" }));

  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(
    headers.get("Referrer-Policy"),
    "strict-origin-when-cross-origin",
  );
  // Location data is never collected, so it must be denied to the browser.
  assert.ok(headers.get("Permissions-Policy")?.includes("geolocation=()"));
  assert.ok(headers.has("Content-Security-Policy"));
});

test("requires HTTPS in deployed environments and stays off locally", () => {
  const local = new Map(getSecurityHeaders({ APP_ENV: "local" }));
  assert.equal(local.has("Strict-Transport-Security"), false);

  for (const appEnvironment of ["staging", "production"]) {
    const headers = new Map(getSecurityHeaders({ APP_ENV: appEnvironment }));
    assert.equal(
      headers.get("Strict-Transport-Security"),
      "max-age=63072000; includeSubDomains; preload",
    );
  }
});

test("refuses a build whose declared environment cannot be classified", () => {
  // The CSP is baked into the build output, so a misclassified deployed build
  // would permanently ship the development policy.
  assert.throws(
    () => validateSecurityHeadersBuildEnvironment({ APP_ENV: "preview" }),
    /one of local, test, staging, or production/,
  );
  for (const appEnvironment of ["local", "test", "staging", "production"]) {
    assert.doesNotThrow(() =>
      validateSecurityHeadersBuildEnvironment({ APP_ENV: appEnvironment }),
    );
  }

  // The documented local `pnpm run build` sets no APP_ENV and must keep
  // working without environment setup; it intentionally builds the development
  // policy.
  for (const value of [undefined, "", "   "]) {
    assert.doesNotThrow(() =>
      validateSecurityHeadersBuildEnvironment({ APP_ENV: value }),
    );
  }
});
