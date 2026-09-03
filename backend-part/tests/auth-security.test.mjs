import assert from "node:assert/strict";
import test from "node:test";

import "reflect-metadata";

process.env.APP_ENV = "test";
process.env.JWT_ACCESS_SECRET =
  "test-access-secret-with-at-least-32-characters";
process.env.REFRESH_TOKEN_SECRET =
  "test-refresh-secret-that-is-different-and-long";
process.env.JWT_ACCESS_TTL = "15m";

const [{ PasswordService }, { TokenService }, { RolesGuard }, { Reflector }] =
  await Promise.all([
    import("../dist/modules/auth/password.service.js"),
    import("../dist/modules/auth/token.service.js"),
    import("../dist/modules/auth/roles.guard.js"),
    import("@nestjs/core"),
  ]);

test("hashes passwords with Argon2id and rejects the wrong password", async () => {
  const passwords = new PasswordService();
  const hash = await passwords.hash("long-test-password-123");

  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await passwords.verify(hash, "long-test-password-123"), true);
  assert.equal(await passwords.verify(hash, "wrong-password"), false);
});

test("signs narrowly scoped access tokens and rejects tampering", async () => {
  const tokens = new TokenService();
  const user = {
    id: "00000000-0000-4000-8000-000000000101",
    email: "student@example.test",
    role: null,
    preferredLocale: "KM",
    onboardingComplete: false,
  };
  const token = await tokens.createAccessToken(user);

  assert.deepEqual(await tokens.verifyAccessToken(token), {
    ...user,
    email: null,
  });
  const [header, payload, signature] = token.split(".");
  const tamperedSignature = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
  await assert.rejects(
    tokens.verifyAccessToken(`${header}.${payload}.${tamperedSignature}`),
    (error) => error.getResponse().code === "ACCESS_TOKEN_INVALID",
  );
});

test("uses purpose-separated HMAC hashes for opaque tokens and IP metadata", () => {
  const tokens = new TokenService();
  const refresh = tokens.createRefreshToken(
    new Date("2026-09-03T00:00:00.000Z"),
  );
  const reset = tokens.createPasswordResetToken(
    new Date("2026-09-03T00:00:00.000Z"),
  );

  assert.equal(tokens.digestRefreshToken(refresh.token), refresh.hash);
  assert.notEqual(tokens.digestPasswordResetToken(refresh.token), refresh.hash);
  assert.notEqual(tokens.hashIpAddress("127.0.0.1"), "127.0.0.1");
  assert.equal(reset.expiresAt.toISOString(), "2026-09-03T00:30:00.000Z");
});

test("role guard allows only authenticated principals with an accepted role", () => {
  const handler = () => undefined;
  Reflect.defineMetadata("findme.required-roles", ["ADMIN"], handler);
  const guard = new RolesGuard(new Reflector());
  const createContext = (role) => ({
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({
        user: role
          ? {
              id: "00000000-0000-4000-8000-000000000101",
              email: "user@example.test",
              role,
              preferredLocale: "KM",
              onboardingComplete: true,
            }
          : undefined,
      }),
    }),
  });

  assert.equal(guard.canActivate(createContext("ADMIN")), true);
  assert.throws(
    () => guard.canActivate(createContext("STUDENT")),
    (error) => error.getResponse().code === "ROLE_FORBIDDEN",
  );
  assert.throws(
    () => guard.canActivate(createContext(null)),
    (error) => error.getResponse().code === "ROLE_FORBIDDEN",
  );
});
