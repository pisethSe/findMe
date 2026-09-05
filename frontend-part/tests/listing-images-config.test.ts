import assert from "node:assert/strict";
import test from "node:test";

import { getListingImageRemotePatterns } from "../src/config/listing-images.ts";

test("allows local development without configured listing media", () => {
  assert.deepEqual(getListingImageRemotePatterns({ APP_ENV: "local" }), []);
});

test("builds a strict Next Image pattern from the configured CDN path", () => {
  const patterns = getListingImageRemotePatterns({
    APP_ENV: "production",
    CDN_BASE_URL: "https://media.example.test/findme",
  });

  assert.equal(patterns[0]?.protocol, "https:");
  assert.equal(patterns[0]?.hostname, "media.example.test");
  assert.equal(patterns[0]?.pathname, "/findme/**");
});

test("requires a safe HTTPS CDN for deployed image optimization", () => {
  assert.throws(
    () => getListingImageRemotePatterns({ APP_ENV: "production" }),
    /required/,
  );
  assert.throws(
    () =>
      getListingImageRemotePatterns({
        APP_ENV: "staging",
        CDN_BASE_URL: "http://media.example.test",
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      getListingImageRemotePatterns({
        CDN_BASE_URL: "https://user:secret@media.example.test/images?q=all",
      }),
    /credentials/,
  );
});
