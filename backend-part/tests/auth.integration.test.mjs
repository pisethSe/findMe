import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { config as loadEnvironment } from "dotenv";
import pg from "pg";

loadEnvironment({
  path: new URL("../../.env", import.meta.url).pathname,
  quiet: true,
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test(
  "register, authenticate, rotate, reset, and revoke a real database session",
  { skip: !testDatabaseUrl, timeout: 30_000 },
  async () => {
    const port = 32_173;
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;
    const webOrigin = "http://localhost:3000";
    const email = `auth-${randomUUID()}@example.test`;
    const originalPassword = "student-password-123";
    const newPassword = "replacement-password-456";
    const server = spawn(process.execPath, ["dist/main.js"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        APP_ENV: "test",
        PORT: String(port),
        WEB_ORIGIN: webOrigin,
        DATABASE_URL: testDatabaseUrl,
        JWT_ACCESS_SECRET: "integration-access-secret-is-long-and-unique",
        REFRESH_TOKEN_SECRET:
          "integration-refresh-secret-is-also-long-and-unique",
        JWT_ACCESS_TTL: "15m",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let serverOutput = "";
    server.stdout.on("data", (chunk) => {
      serverOutput += String(chunk);
    });
    server.stderr.on("data", (chunk) => {
      serverOutput += String(chunk);
    });

    const database = new pg.Client({ connectionString: testDatabaseUrl });
    await database.connect();

    try {
      await waitForServer(`${baseUrl}/health/live`, server, () => serverOutput);

      const invalidRegistration = await api(`${baseUrl}/auth/register`, {
        email,
        password: originalPassword,
        preferredLocale: "KM",
        role: "ADMIN",
      });
      assert.equal(invalidRegistration.response.status, 400);
      assert.equal(invalidRegistration.body.error.code, "VALIDATION_FAILED");

      const registration = await api(`${baseUrl}/auth/register`, {
        email,
        password: originalPassword,
        preferredLocale: "KM",
      });
      assert.equal(registration.response.status, 201);
      assert.equal(registration.body.data.user.email, email);
      assert.equal(registration.body.data.user.role, null);
      assert.equal(registration.body.data.user.onboardingComplete, false);
      assert.equal("passwordHash" in registration.body.data.user, false);
      const firstCookie = cookieFrom(registration.response);
      const setCookie = registration.response.headers.get("set-cookie") ?? "";
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /SameSite=Lax/);
      assert.match(setCookie, /Path=\/api\/v1\/auth/);

      const storedSession = await database.query(
        `SELECT token_hash
         FROM refresh_sessions
         WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
        [email],
      );
      assert.match(storedSession.rows[0].token_hash, /^[a-f0-9]{64}$/);
      assert.notEqual(
        storedSession.rows[0].token_hash,
        firstCookie.split("=")[1],
      );

      const missingToken = await fetch(`${baseUrl}/auth/me`);
      assert.equal(missingToken.status, 401);
      assert.equal(
        (await missingToken.json()).error.code,
        "ACCESS_TOKEN_REQUIRED",
      );

      const me = await fetch(`${baseUrl}/auth/me`, {
        headers: {
          authorization: `Bearer ${registration.body.data.accessToken}`,
        },
      });
      assert.equal(me.status, 200);
      assert.equal((await me.json()).data.email, email);

      const forbiddenOrigin = await api(
        `${baseUrl}/auth/refresh`,
        {},
        { cookie: firstCookie, origin: "https://untrusted.example" },
      );
      assert.equal(forbiddenOrigin.response.status, 403);
      assert.equal(forbiddenOrigin.body.error.code, "ORIGIN_FORBIDDEN");

      const refresh = await api(
        `${baseUrl}/auth/refresh`,
        {},
        { cookie: firstCookie, origin: webOrigin },
      );
      assert.equal(refresh.response.status, 200);
      const rotatedCookie = cookieFrom(refresh.response);
      assert.notEqual(rotatedCookie, firstCookie);

      const reused = await api(
        `${baseUrl}/auth/refresh`,
        {},
        { cookie: firstCookie, origin: webOrigin },
      );
      assert.equal(reused.response.status, 401);
      assert.equal(reused.body.error.code, "SESSION_INVALID");

      const forgot = await api(`${baseUrl}/auth/forgot-password`, { email });
      assert.equal(forgot.response.status, 202);
      assert.equal(forgot.body.data.accepted, true);
      assert.equal(typeof forgot.body.data.developmentResetToken, "string");

      const reset = await api(`${baseUrl}/auth/reset-password`, {
        token: forgot.body.data.developmentResetToken,
        password: newPassword,
      });
      assert.equal(reset.response.status, 200);

      const oldLogin = await api(`${baseUrl}/auth/login`, {
        email,
        password: originalPassword,
      });
      assert.equal(oldLogin.response.status, 401);
      assert.equal(oldLogin.body.error.code, "INVALID_CREDENTIALS");

      const newLogin = await api(`${baseUrl}/auth/login`, {
        email,
        password: newPassword,
      });
      assert.equal(newLogin.response.status, 200);
      const loginCookie = cookieFrom(newLogin.response);

      const resetRevoked = await api(
        `${baseUrl}/auth/refresh`,
        {},
        { cookie: rotatedCookie, origin: webOrigin },
      );
      assert.equal(resetRevoked.response.status, 401);

      const logout = await api(
        `${baseUrl}/auth/logout`,
        {},
        { cookie: loginCookie, origin: webOrigin },
      );
      assert.equal(logout.response.status, 204);
      assert.match(
        logout.response.headers.get("set-cookie") ?? "",
        /Max-Age=0/,
      );

      const loggedOutRefresh = await api(
        `${baseUrl}/auth/refresh`,
        {},
        { cookie: loginCookie, origin: webOrigin },
      );
      assert.equal(loggedOutRefresh.response.status, 401);

      const stored = await database.query(
        "SELECT password_hash, role FROM users WHERE email = $1",
        [email],
      );
      assert.match(stored.rows[0].password_hash, /^\$argon2id\$/);
      assert.equal(stored.rows[0].role, null);
    } finally {
      await database.query("DELETE FROM users WHERE email = $1", [email]);
      await database.end();
      if (server.exitCode === null) {
        server.kill("SIGTERM");
        await new Promise((resolve) => server.once("exit", resolve));
      }
    }
  },
);

async function api(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return {
    response,
    body: response.status === 204 ? null : await response.json(),
  };
}

function cookieFrom(response) {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "expected the response to set a refresh cookie");
  return setCookie.split(";", 1)[0];
}

async function waitForServer(url, server, output) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) {
      assert.fail(`API exited before becoming ready:\n${output()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`API did not become ready:\n${output()}`);
}
