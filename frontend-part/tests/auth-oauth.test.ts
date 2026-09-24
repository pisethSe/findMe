import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test/api/v1";

const { fetchAuthProviders, googleSignInUrl } =
  await import("../src/features/auth/auth-api.ts");
const { oauthErrorMessage } =
  await import("../src/features/auth/oauth-errors.ts");

test("googleSignInUrl targets the backend start route and passes safe next paths", () => {
  assert.equal(
    googleSignInUrl(null),
    "https://api.example.test/api/v1/auth/google/start",
  );
  const withNext = new URL(googleSignInUrl("/search?maxRentUsd=150"));
  assert.equal(
    withNext.origin + withNext.pathname,
    "https://api.example.test/api/v1/auth/google/start",
  );
  assert.equal(withNext.searchParams.get("next"), "/search?maxRentUsd=150");
});

test("fetchAuthProviders treats anything but an explicit true as unsupported", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ data: { google: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    assert.deepEqual(await fetchAuthProviders(), { google: true });

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    assert.deepEqual(await fetchAuthProviders(), { google: false });

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { code: "REQUEST_FAILED" } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    await assert.rejects(fetchAuthProviders());
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("oauthErrorMessage maps every OAuth failure code and falls back safely", () => {
  const knownCodes = [
    "OAUTH_STATE_INVALID",
    "OAUTH_CODE_MISSING",
    "OAUTH_PROVIDER_DENIED",
    "OAUTH_NOT_CONFIGURED",
    "OAUTH_REDIRECT_UNRESOLVED",
    "OAUTH_EMAIL_UNVERIFIED",
    "OAUTH_PROFILE_INVALID",
    "ACCOUNT_UNAVAILABLE",
    "ACCOUNT_ALREADY_EXISTS",
    "GOOGLE_ACCOUNT_ALREADY_LINKED",
  ];
  for (const code of knownCodes) {
    assert.notEqual(
      oauthErrorMessage(code),
      "Google sign-in could not be completed. Please try again.",
      `code ${code} should have specific copy`,
    );
  }
  // Exchange and generic failures intentionally share the generic copy.
  assert.equal(
    oauthErrorMessage("OAUTH_EXCHANGE_FAILED"),
    "Google sign-in could not be completed. Please try again.",
  );
  assert.equal(
    oauthErrorMessage(null),
    "Google sign-in could not be completed. Please try again.",
  );
  assert.equal(
    oauthErrorMessage("TOTALLY_UNKNOWN_CODE"),
    "Google sign-in could not be completed. Please try again.",
  );
  assert.equal(
    oauthErrorMessage("OAUTH_SIGNIN_FAILED"),
    oauthErrorMessage("OAUTH_EXCHANGE_FAILED"),
  );
});
