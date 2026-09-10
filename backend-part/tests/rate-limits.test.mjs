import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { createClient } from "redis";
import {
  MemoryRateLimitStore,
  RedisRateLimitStore,
} from "../dist/modules/rate-limits/rate-limit.store.js";
import { RateLimitService } from "../dist/modules/rate-limits/rate-limit.service.js";
import {
  rateLimitEmail,
  rateLimitIp,
} from "../dist/modules/rate-limits/rate-limit.identity.js";
import { getTrustedProxyCidrs } from "../dist/config/environment.js";

process.env.REFRESH_TOKEN_SECRET =
  "rate-limit-test-secret-at-least-32-characters";

test("IP identity normalizes mapped IPv4 and IPv6 privacy addresses without trusting arbitrary text", () => {
  assert.equal(rateLimitIp("192.0.2.1"), "192.0.2.1");
  assert.equal(rateLimitIp("::ffff:192.0.2.1"), "192.0.2.1");
  assert.equal(rateLimitIp("::FFFF:c000:201"), "192.0.2.1");
  assert.equal(rateLimitIp("2001:db8:1:2:3:4:5:6"), "2001:db8:1:2::/64");
  assert.equal(rateLimitIp("2001:0DB8:0001:0002::7"), "2001:db8:1:2::/64");
  assert.notEqual(
    rateLimitIp("2001:db8:1:3::7"),
    rateLimitIp("2001:db8:1:2::7"),
  );
  assert.equal(rateLimitIp("fe80::1%en0"), "fe80:0:0:0::/64");
  for (const value of [undefined, "", "invalid", "192.0.2.1, 192.0.2.2"])
    assert.equal(rateLimitIp(value), "unknown");
  assert.equal(
    rateLimitEmail({ email: " Dara@Example.Test " }),
    "dara@example.test",
  );
  for (const value of [
    null,
    "dara@example.test",
    { email: {} },
    { email: "a".repeat(321) },
    {},
  ])
    assert.equal(rateLimitEmail(value), null);
});

test("proxy trust is explicit IP/CIDR configuration and rejects blanket/hop-count trust", () => {
  assert.deepEqual(getTrustedProxyCidrs(undefined), []);
  assert.deepEqual(getTrustedProxyCidrs("127.0.0.1, ::1/128,10.0.1.0/24"), [
    "127.0.0.1",
    "::1/128",
    "10.0.1.0/24",
  ]);
  for (const value of [
    "true",
    "1",
    "loopback",
    "0.0.0.0/0",
    "::/0",
    "10.0.0.1/33",
    "::1/129",
    "10.0.0.1/",
    "127.0.0.1,",
    "proxy.test",
    "::1%en0",
    "1.1.1.1/2/3",
  ])
    assert.throws(() => getTrustedProxyCidrs(value), /TRUSTED_PROXY_CIDRS/);
});

test("fallback limits exact boundaries, does not extend blocked windows or evict active identities", () => {
  const store = new MemoryRateLimitStore(2);
  const window = { limit: 2, seconds: 10 };
  assert.equal(store.consume("a", window, 0).allowed, true);
  assert.equal(store.consume("a", window, 1).allowed, true);
  assert.deepEqual(store.consume("a", window, 1001), {
    allowed: false,
    retryAfterSeconds: 9,
  });
  assert.equal(store.consume("b", window, 2000).allowed, true);
  assert.equal(store.consume("c", window, 3000), null);
  assert.equal(store.consume("a", window, 9999).allowed, false);
  assert.equal(store.consume("a", window, 10000).allowed, true);
  assert.equal(store.consume("b", window, 12000).allowed, true);
  assert.equal(store.consume("a", window, 20000).allowed, true);
});

test("hashed identities isolate policies and scopes without retaining personal data or credentials", async () => {
  const keys = [];
  const service = new RateLimitService({
    consume: async (key) => {
      keys.push(key);
      return { allowed: true, retryAfterSeconds: 60 };
    },
  });
  for (const [policy, scope] of [
    ["login", "ip"],
    ["login", "email"],
    ["passwordReset", "ip"],
  ]) {
    await service.enforce(policy, scope, "private@example.test", {
      limit: 1,
      seconds: 60,
    });
  }
  assert.equal(new Set(keys).size, 3);
  assert.ok(keys.every((key) => /:[a-f0-9]{64}$/.test(key)));
  assert.doesNotMatch(keys.join(" "), /private|example|password-secret/);
});

test("Redis outage has a bounded fallback, but deployed sensitive actions fail before mutation", async () => {
  const previous = process.env.APP_ENV;
  const unavailable = { consume: async () => null };
  try {
    process.env.APP_ENV = "local";
    const local = new RateLimitService(unavailable);
    await local.enforce("login", "ip", "a", { limit: 1, seconds: 60 });
    await assert.rejects(
      local.enforce("login", "ip", "a", { limit: 1, seconds: 60 }),
      (error) =>
        error.getStatus() === 429 && error.getResponse().retryAfterSeconds > 0,
    );
    for (const mode of ["staging", "production"]) {
      process.env.APP_ENV = mode;
      const service = new RateLimitService(unavailable);
      for (const policy of [
        "login",
        "registration",
        "passwordResetRequest",
        "passwordReset",
        "sessionRefresh",
        "uploadIntent",
        "mediaFinalize",
        "adminWrite",
      ])
        await assert.rejects(
          service.enforce(policy, "ip", "a", { limit: 1, seconds: 60 }),
          (error) =>
            error.getStatus() === 503 &&
            error.getResponse().code === "RATE_LIMIT_UNAVAILABLE",
        );
      for (const policy of [
        "search",
        "catalog",
        "listingRead",
        "inquiry",
        "report",
      ]) {
        await service.enforce(policy, "ip", "a", { limit: 1, seconds: 60 });
        await assert.rejects(
          service.enforce(policy, "ip", "a", { limit: 1, seconds: 60 }),
          (error) => error.getStatus() === 429,
        );
      }
    }
  } finally {
    if (previous === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previous;
  }
});

test(
  "a nonresponsive Redis connection times out and cools down without exposing its error",
  { timeout: 5000 },
  async () => {
    const sockets = new Set();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const previous = process.env.REDIS_URL;
    process.env.REDIS_URL = `redis://127.0.0.1:${server.address().port}`;
    const store = new RedisRateLimitStore();
    try {
      const started = performance.now();
      assert.equal(
        await store.consume("test", { limit: 1, seconds: 60 }),
        null,
      );
      assert.ok(performance.now() - started < 2500);
      const retry = performance.now();
      assert.equal(
        await store.consume("test", { limit: 1, seconds: 60 }),
        null,
      );
      assert.ok(performance.now() - retry < 100);
    } finally {
      store.onModuleDestroy();
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
      if (previous === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previous;
    }
  },
);

test(
  "real Redis atomically limits across instances, expires counters and recovers after key loss",
  { skip: !process.env.TEST_REDIS_URL, timeout: 10000 },
  async () => {
    const previous = process.env.REDIS_URL;
    process.env.REDIS_URL = process.env.TEST_REDIS_URL;
    const stores = [new RedisRateLimitStore(), new RedisRateLimitStore()];
    const redis = createClient({ url: process.env.TEST_REDIS_URL });
    redis.on("error", () => undefined);
    await redis.connect();
    const key = `findme:rate-test:${randomUUID()}`;
    try {
      const results = await Promise.all(
        Array.from({ length: 40 }, (_, index) =>
          stores[index % 2].consume(key, { limit: 7, seconds: 1 }),
        ),
      );
      assert.equal(results.filter((result) => result?.allowed).length, 7);
      assert.equal(
        results.filter((result) => result && !result.allowed).length,
        33,
      );
      const ttl = await redis.pTTL(key);
      assert.ok(ttl > 0 && ttl <= 1000);
      assert.equal(await redis.get(key), "7");
      await delay(ttl + 30);
      assert.equal(
        (await stores[0].consume(key, { limit: 7, seconds: 60 })).allowed,
        true,
      );
      assert.equal(await redis.get(key), "1");
      await redis.del(key);
      assert.equal(
        (await stores[1].consume(key, { limit: 7, seconds: 60 })).allowed,
        true,
      );
      // A legacy/corrupt immortal key is repaired with an explicit TTL.
      await redis.persist(key);
      assert.equal(
        (await stores[0].consume(key, { limit: 7, seconds: 60 })).allowed,
        true,
      );
      assert.ok((await redis.pTTL(key)) > 0);
    } finally {
      stores.forEach((store) => store.onModuleDestroy());
      await redis.del(key);
      await redis.quit();
      if (previous === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previous;
    }
  },
);
