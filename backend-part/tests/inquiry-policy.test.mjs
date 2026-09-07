import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createClient } from "redis";
import {
  assertInquiryRateLimit,
  assertInquiryTransition,
} from "../dist/modules/inquiries/inquiry-policy.js";
import { InquiryRateLimiter } from "../dist/modules/inquiries/inquiry-rate-limiter.js";

test("inquiry state progression and rolling rate boundaries are explicit", () => {
  const states = ["NEW", "READ", "RESPONDED", "CLOSED"];
  for (const [i, from] of states.entries())
    for (const [j, to] of states.entries()) {
      if (j >= i) assert.doesNotThrow(() => assertInquiryTransition(from, to));
      else
        assert.throws(
          () => assertInquiryTransition(from, to),
          (e) => e.getResponse().code === "INQUIRY_STATUS_CONFLICT",
        );
    }
  const now = new Date("2026-09-07T00:00:00Z");
  const past = (ms) => new Date(now.getTime() - ms);
  assert.doesNotThrow(() =>
    assertInquiryRateLimit(
      [{ listingId: "a", createdAt: past(60000) }],
      "a",
      now,
    ),
  );
  assert.throws(
    () =>
      assertInquiryRateLimit(
        [{ listingId: "a", createdAt: past(59999) }],
        "a",
        now,
      ),
    (e) => e.getStatus() === 429,
  );
  assert.throws(
    () =>
      assertInquiryRateLimit(
        Array.from({ length: 10 }, () => ({
          listingId: "a",
          createdAt: past(120000),
        })),
        "b",
        now,
      ),
    (e) => e.getStatus() === 429,
  );
  assert.doesNotThrow(() =>
    assertInquiryRateLimit(
      Array.from({ length: 10 }, () => ({
        listingId: "a",
        createdAt: past(3600000),
      })),
      "b",
      now,
    ),
  );
});

test(
  "Redis inquiry limiter counts committed IDs once, expires keys and tolerates outage",
  { skip: !process.env.TEST_REDIS_URL },
  async () => {
    const previous = process.env.REDIS_URL;
    process.env.REDIS_URL = process.env.TEST_REDIS_URL;
    const limiter = new InquiryRateLimiter();
    const redis = createClient({ url: process.env.TEST_REDIS_URL });
    redis.on("error", () => undefined);
    await redis.connect();
    const studentId = randomUUID();
    const listingId = randomUUID();
    const now = new Date();
    const key = `findme:v1:inquiry-limit:${studentId}`;
    try {
      assert.equal(await limiter.isLimited(studentId, listingId, now), false);
      const inquiry = { id: randomUUID(), listingId, createdAt: now };
      await limiter.record(studentId, inquiry);
      await limiter.record(studentId, inquiry);
      assert.equal(await redis.zCard(key), 1);
      assert.ok((await redis.ttl(key)) > 0 && (await redis.ttl(key)) <= 3600);
      assert.equal(
        await limiter.isLimited(
          studentId,
          listingId,
          new Date(now.getTime() + 59999),
        ),
        true,
      );
      assert.equal(
        await limiter.isLimited(
          studentId,
          listingId,
          new Date(now.getTime() + 60000),
        ),
        false,
      );
      assert.equal(
        await limiter.isLimited(studentId, randomUUID(), now),
        false,
      );
      for (let i = 0; i < 9; i++)
        await limiter.record(studentId, {
          id: randomUUID(),
          listingId: randomUUID(),
          createdAt: now,
        });
      assert.equal(await limiter.isLimited(studentId, randomUUID(), now), true);
      assert.equal(
        await limiter.isLimited(
          studentId,
          listingId,
          new Date(now.getTime() + 3600000),
        ),
        false,
      );
      await limiter.onModuleDestroy();
      // An unavailable Redis endpoint never replaces the database limiter.
      process.env.REDIS_URL = "redis://127.0.0.1:6398";
      const unavailable = new InquiryRateLimiter();
      try {
        assert.equal(
          await unavailable.isLimited(studentId, listingId, now),
          false,
        );
        await unavailable.record(studentId, inquiry);
      } finally {
        await unavailable.onModuleDestroy();
      }
    } finally {
      await limiter.onModuleDestroy();
      await redis.del(key);
      await redis.quit();
      if (previous === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previous;
    }
  },
);
