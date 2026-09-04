import assert from "node:assert/strict";
import test from "node:test";

import {
  getAppEnvironment,
  getAuthSecret,
  getDatabaseUrl,
  getGoogleMapsServerKey,
  getWebOrigin,
  parseAccessTokenTtl,
  parseApiPort,
  parsePasswordResetTtlMinutes,
  parseRefreshTokenTtlDays,
  validateApplicationEnvironment,
  validateAuthEnvironment,
} from "../dist/config/environment.js";

test("uses safe local API configuration defaults", () => {
  assert.equal(parseApiPort(undefined), 3001);
  assert.equal(getWebOrigin(undefined), "http://localhost:3000");
});

test("accepts only explicit PostgreSQL database URLs", () => {
  assert.equal(
    getDatabaseUrl("postgresql://findme:secret@localhost:5432/findme"),
    "postgresql://findme:secret@localhost:5432/findme",
  );
  assert.throws(() => getDatabaseUrl(undefined), /DATABASE_URL/);
  assert.throws(() => getDatabaseUrl("redis://localhost:6379"), /postgres/i);
  assert.throws(() => getDatabaseUrl("not a url"), /DATABASE_URL/);
});

test("rejects malformed ports and browser origins", () => {
  assert.throws(() => parseApiPort("70000"), /PORT/);
  assert.throws(() => parseApiPort("not-a-number"), /PORT/);
  assert.throws(() => getWebOrigin("javascript:alert(1)"), /WEB_ORIGIN/);
  assert.throws(() => getWebOrigin("https://example.com/path"), /WEB_ORIGIN/);
});

test("validates authentication secrets and bounded token lifetimes", () => {
  assert.equal(getAppEnvironment(undefined), "local");
  assert.equal(parseAccessTokenTtl(undefined).seconds, 900);
  assert.equal(parseAccessTokenTtl("1h").seconds, 3600);
  assert.equal(parseRefreshTokenTtlDays(undefined), 30);
  assert.equal(parsePasswordResetTtlMinutes(undefined), 30);

  assert.throws(
    () => getAuthSecret("JWT_ACCESS_SECRET", "too-short"),
    /32 characters/,
  );
  assert.throws(() => parseAccessTokenTtl("2h"), /between 60 seconds/);
  assert.throws(() => getAppEnvironment("preview"), /APP_ENV/);
  assert.throws(
    () =>
      validateAuthEnvironment({
        JWT_ACCESS_SECRET: "a".repeat(32),
        REFRESH_TOKEN_SECRET: "a".repeat(32),
      }),
    /must be different/,
  );
  assert.throws(
    () =>
      validateAuthEnvironment({
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "a".repeat(32),
        REFRESH_TOKEN_SECRET: "b".repeat(32),
      }),
    /APP_ENV must be explicit/,
  );
  assert.throws(
    () =>
      validateAuthEnvironment({
        NODE_ENV: "production",
        APP_ENV: "production",
        JWT_ACCESS_SECRET: "replace-with-a-long-production-secret-value",
        REFRESH_TOKEN_SECRET: "b".repeat(32),
      }),
    /Placeholder authentication secrets/,
  );
});

test("requires a safe server-only Google Maps key for deployed environments", () => {
  assert.equal(getGoogleMapsServerKey(undefined, "local"), null);
  assert.throws(
    () => getGoogleMapsServerKey(undefined, "production"),
    /GOOGLE_MAPS_SERVER_KEY is required/,
  );
  assert.throws(
    () => getGoogleMapsServerKey("replace-with-your-api-key", "staging"),
    /malformed or still a placeholder/,
  );
  assert.equal(
    getGoogleMapsServerKey(`AIza${"s".repeat(35)}`, "production"),
    `AIza${"s".repeat(35)}`,
  );
});

test("validates Maps configuration as part of application startup", () => {
  assert.doesNotThrow(() =>
    validateApplicationEnvironment({
      APP_ENV: "production",
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a".repeat(32),
      REFRESH_TOKEN_SECRET: "b".repeat(32),
      GOOGLE_MAPS_SERVER_KEY: `AIza${"s".repeat(35)}`,
    }),
  );
  assert.throws(
    () =>
      validateApplicationEnvironment({
        APP_ENV: "production",
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "a".repeat(32),
        REFRESH_TOKEN_SECRET: "b".repeat(32),
      }),
    /GOOGLE_MAPS_SERVER_KEY is required/,
  );
});
