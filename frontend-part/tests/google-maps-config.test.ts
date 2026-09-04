import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveGoogleMapsBrowserConfig,
  validateGoogleMapsBuildEnvironment,
} from "../src/config/google-maps.ts";

const browserKey = `AIza${"a".repeat(35)}`;
const mapId = "8e0a97af9386fef";

test("keeps Google Maps disabled when local credentials are absent", () => {
  assert.deepEqual(
    resolveGoogleMapsBrowserConfig({ apiKey: undefined, mapId: undefined }),
    { status: "DISABLED" },
  );
});

test("requires the browser key and map ID as one configuration", () => {
  assert.equal(
    resolveGoogleMapsBrowserConfig({ apiKey: browserKey, mapId: undefined })
      .status,
    "INVALID",
  );
  assert.equal(
    resolveGoogleMapsBrowserConfig({ apiKey: undefined, mapId }).status,
    "INVALID",
  );
});

test("accepts safe browser configuration without exposing it in errors", () => {
  assert.deepEqual(
    resolveGoogleMapsBrowserConfig({ apiKey: browserKey, mapId }),
    { status: "READY", config: { apiKey: browserKey, mapId } },
  );
  const placeholder = "replace-with-your-api-key";
  const invalid = resolveGoogleMapsBrowserConfig({
    apiKey: placeholder,
    mapId,
  });
  assert.equal(invalid.status, "INVALID");
  assert.equal(JSON.stringify(invalid).includes(placeholder), false);
});

test("fails staging and production builds without complete Maps configuration", () => {
  assert.throws(
    () => validateGoogleMapsBuildEnvironment({ APP_ENV: "production" }),
    /Google Maps build configuration is invalid/,
  );
  assert.equal(
    validateGoogleMapsBuildEnvironment({
      APP_ENV: "staging",
      NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: browserKey,
      NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: mapId,
    }).status,
    "READY",
  );
});
