import assert from "node:assert/strict";
import test from "node:test";

import { getGoogleOAuthConfig } from "../dist/config/environment.js";
import { PasswordService } from "../dist/modules/auth/password.service.js";
import { OAUTH_ONLY_PASSWORD_HASH } from "../dist/modules/auth/auth.types.js";
import { GoogleOAuthService } from "../dist/modules/auth/google-oauth.service.js";
import {
  createGoogleOAuthState,
  verifyGoogleOAuthState,
} from "../dist/modules/auth/google-oauth.state.js";

const OAUTH_ENV_KEYS = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URL",
  "JWT_ACCESS_SECRET",
];

async function withOAuthEnv(overrides, run) {
  const saved = Object.fromEntries(
    OAUTH_ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  for (const key of OAUTH_ENV_KEYS) delete process.env[key];
  Object.assign(process.env, overrides);
  try {
    return await run();
  } finally {
    for (const key of OAUTH_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

function errorCode(thrown) {
  const body =
    typeof thrown.getResponse === "function" ? thrown.getResponse() : thrown;
  return typeof body === "object" && body !== null ? body.code : undefined;
}

test("Google OAuth configuration stays optional and fails fast when incomplete", () => {
  assert.equal(getGoogleOAuthConfig({}), null);
  assert.throws(
    () =>
      getGoogleOAuthConfig({
        GOOGLE_OAUTH_CLIENT_ID: "client-id",
        GOOGLE_OAUTH_REDIRECT_URL: "https://api.example.test/cb",
      }),
    /together/,
  );
  assert.throws(
    () =>
      getGoogleOAuthConfig({
        GOOGLE_OAUTH_REDIRECT_URL: "https://api.example.test/cb",
      }),
    /requires/,
  );
  assert.throws(
    () =>
      getGoogleOAuthConfig({
        GOOGLE_OAUTH_CLIENT_ID: "replace-with-a-real-client-id",
        GOOGLE_OAUTH_CLIENT_SECRET: "secret",
      }),
    /placeholder/,
  );
  assert.throws(
    () =>
      getGoogleOAuthConfig({
        GOOGLE_OAUTH_CLIENT_ID: "client-id",
        GOOGLE_OAUTH_CLIENT_SECRET: "secret",
        GOOGLE_OAUTH_REDIRECT_URL: "javascript:alert(1)",
      }),
    /HTTPS?|http/i,
  );

  const config = getGoogleOAuthConfig({
    GOOGLE_OAUTH_CLIENT_ID: "client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "secret",
    GOOGLE_OAUTH_REDIRECT_URL:
      "https://api.example.test/api/v1/auth/google/callback",
  });
  assert.deepEqual(config, {
    clientId: "client-id",
    clientSecret: "secret",
    redirectUrl: "https://api.example.test/api/v1/auth/google/callback",
  });
});

test("OAuth state round-trips, rejects tampering, expiry, and unsafe next paths", () => {
  const secret = "state-secret";
  const state = createGoogleOAuthState(secret, {
    next: "/search?maxRentUsd=150",
  });
  const payload = verifyGoogleOAuthState(secret, state);
  assert.ok(payload);
  assert.equal(payload.next, "/search?maxRentUsd=150");
  assert.ok(payload.expiresAt > Math.floor(Date.now() / 1000));
  assert.ok(payload.nonce.length >= 8);

  assert.equal(verifyGoogleOAuthState("other-secret", state), null);
  const [body, sig] = state.split(".");
  assert.equal(
    verifyGoogleOAuthState(secret, `${body}.${sig.slice(0, -2)}`),
    null,
  );
  assert.equal(verifyGoogleOAuthState(secret, "not-a-state.value"), null);

  const expired = createGoogleOAuthState(secret, {
    next: "/favorites",
    now: new Date(Date.now() - 700_000),
  });
  assert.equal(verifyGoogleOAuthState(secret, expired), null);

  // Absolute URLs are never used as post-sign-in destinations.
  const external = createGoogleOAuthState(secret, {
    next: "https://evil.example.test/phish",
  });
  const externalPayload = verifyGoogleOAuthState(secret, external);
  assert.ok(externalPayload);
  assert.equal(externalPayload.next, null);
});

test("startUrl is unavailable until configured and signs the state", async () => {
  await withOAuthEnv({}, async () => {
    const service = new GoogleOAuthService({}, {});
    assert.equal(service.isConfigured(), false);
    assert.throws(
      () => service.startUrl({ requestOrigin: "http://localhost:3001" }),
      (thrown) => errorCode(thrown) === "OAUTH_NOT_CONFIGURED",
    );
  });

  await withOAuthEnv(
    {
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "secret",
      JWT_ACCESS_SECRET: "jwt-secret",
    },
    async () => {
      const service = new GoogleOAuthService({}, {});
      assert.equal(service.isConfigured(), true);

      const url = new URL(
        service.startUrl({
          next: "/favorites",
          requestOrigin: "http://localhost:3001",
        }),
      );
      assert.equal(
        url.origin + url.pathname,
        "https://accounts.google.com/o/oauth2/v2/auth",
      );
      assert.equal(url.searchParams.get("client_id"), "client-id");
      assert.equal(url.searchParams.get("response_type"), "code");
      assert.equal(
        url.searchParams.get("redirect_uri"),
        "http://localhost:3001/api/v1/auth/google/callback",
      );
      assert.equal(url.searchParams.get("prompt"), "select_account");

      const state = url.searchParams.get("state");
      assert.ok(state);
      const payload = verifyGoogleOAuthState(
        "findme:google-oauth-state:v1:jwt-secret",
        state,
      );
      assert.ok(payload);
      assert.equal(payload.next, "/favorites");
    },
  );

  await withOAuthEnv(
    {
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "secret",
      GOOGLE_OAUTH_REDIRECT_URL:
        "https://api.example.test/api/v1/auth/google/callback",
      JWT_ACCESS_SECRET: "jwt-secret",
    },
    async () => {
      const service = new GoogleOAuthService({}, {});
      const url = new URL(
        service.startUrl({ requestOrigin: "http://localhost:3001" }),
      );
      assert.equal(
        url.searchParams.get("redirect_uri"),
        "https://api.example.test/api/v1/auth/google/callback",
      );
    },
  );
});

test("completeSignIn refuses missing or forged state before contacting Google", async () => {
  await withOAuthEnv(
    {
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "secret",
      JWT_ACCESS_SECRET: "jwt-secret",
    },
    async () => {
      // The repository stub throws if it is ever used for these failures.
      const service = new GoogleOAuthService(
        {
          findUserByGoogleSubject() {
            throw new Error("repository must not be used");
          },
        },
        {},
      );
      await assert.rejects(
        service.completeSignIn(
          {
            code: "google-code",
            state: undefined,
            requestOrigin: "http://localhost:3001",
          },
          { userAgent: null, ipAddress: null },
        ),
        (thrown) => errorCode(thrown) === "OAUTH_STATE_INVALID",
      );
      await assert.rejects(
        service.completeSignIn(
          {
            code: "google-code",
            state: "forged.statevalue",
            requestOrigin: "http://localhost:3001",
          },
          { userAgent: null, ipAddress: null },
        ),
        (thrown) => errorCode(thrown) === "OAUTH_STATE_INVALID",
      );
    },
  );
});

test("OAuth-only password hash can never verify a password sign-in", async () => {
  const passwords = new PasswordService();
  assert.equal(
    await passwords.verify(OAUTH_ONLY_PASSWORD_HASH, "any-password"),
    false,
  );
  assert.equal(
    await passwords.verify(OAUTH_ONLY_PASSWORD_HASH, OAUTH_ONLY_PASSWORD_HASH),
    false,
  );
});
