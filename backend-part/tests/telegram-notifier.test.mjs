import assert from "node:assert/strict";
import test from "node:test";

import { InquiriesService } from "../dist/modules/inquiries/inquiries.service.js";
import {
  buildInquiryMessage,
  TelegramNotifier,
} from "../dist/modules/inquiries/telegram-notifier.js";

const notification = {
  inquiryId: "0f9c1f0a-0000-4000-8000-000000000001",
  listingId: "0f9c1f0a-0000-4000-8000-000000000002",
  listingSlug: "room-near-rupp",
  titleKm: "បន្ទប់ជួលជិត RUPP",
  titleEn: "Room near RUPP",
  message: "Can I visit on Saturday? <script>alert(1)</script>",
  createdAt: new Date("2026-09-26T08:00:00Z"),
};

test("inquiry alert text is plain and bounded", () => {
  const text = buildInquiryMessage(notification);
  assert.match(text, /New student inquiry/);
  assert.match(text, /Room near RUPP/);
  assert.match(text, new RegExp(notification.inquiryId));
  assert.match(text, /2026-09-26T08:00:00\.000Z/);
  assert.match(text, /Can I visit on Saturday/);
  assert.ok(text.length <= 3500);

  const long = buildInquiryMessage({
    ...notification,
    message: "x".repeat(9000),
  });
  assert.ok(long.length <= 3500);
  assert.ok(long.endsWith("…"));

  const fallback = buildInquiryMessage({
    ...notification,
    titleEn: null,
    titleKm: null,
  });
  assert.match(fallback, /room-near-rupp/);
});

test("notify is a no-op while Telegram is unconfigured", async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_INQUIRIES_CHAT_ID;
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("fetch must not be called");
  };
  try {
    const notifier = new TelegramNotifier();
    assert.equal(notifier.config(), null);
    await notifier.notifyNewInquiry(notification);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("notify posts once, swallows failures, and backs off", async () => {
  const token = `123456789:${"A".repeat(35)}`;
  process.env.TELEGRAM_BOT_TOKEN = token;
  process.env.TELEGRAM_INQUIRIES_CHAT_ID = "-1001234567890";
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    const notifier = new TelegramNotifier();
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      return { ok: true };
    };
    await notifier.notifyNewInquiry(notification);
    assert.equal(calls.length, 1);
    assert.equal(
      String(calls[0].url),
      `https://api.telegram.org/bot${token}/sendMessage`,
    );
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.chat_id, "-1001234567890");
    assert.match(body.text, /New student inquiry/);
    assert.ok(calls[0].init.signal instanceof AbortSignal);

    // Failure is swallowed and triggers the backoff window.
    globalThis.fetch = async () => {
      throw new Error("network down");
    };
    await notifier.notifyNewInquiry(notification);

    // Backoff suppresses the next attempt entirely.
    const before = calls.length;
    globalThis.fetch = async () => {
      calls.push({});
      return { ok: true };
    };
    await notifier.notifyNewInquiry(notification);
    assert.equal(calls.length, before);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_INQUIRIES_CHAT_ID;
    globalThis.fetch = originalFetch;
  }
});

test("service alerts only fresh creations, never idempotent replays", async () => {
  const token = `123456789:${"A".repeat(35)}`;
  process.env.TELEGRAM_BOT_TOKEN = token;
  process.env.TELEGRAM_INQUIRIES_CHAT_ID = "-1001234567890";
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return { ok: true };
  };

  const row = {
    id: "0f9c1f0a-0000-4000-8000-000000000003",
    message: "Is this room still available?",
    status: "NEW",
    createdAt: new Date("2026-09-26T09:00:00Z"),
    updatedAt: new Date("2026-09-26T09:00:00Z"),
    listing: {
      id: "0f9c1f0a-0000-4000-8000-000000000004",
      slug: "room-near-rupp",
      titleKm: null,
      titleEn: "Room near RUPP",
    },
  };
  let created = true;
  const repository = {
    create: async () => ({ created, inquiry: row }),
  };
  const notifier = new TelegramNotifier();
  const service = new InquiriesService(repository, notifier);
  const student = {
    id: "student-1",
    role: "STUDENT",
    onboardingComplete: true,
  };

  try {
    await service.create(student, row.listing.id, {
      message: row.message,
      clientRequestId: "0f9c1f0a-0000-4000-8000-000000000005",
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].chat_id, "-1001234567890");
    assert.match(sent[0].text, /Is this room still available\?/);

    // Replay of the same clientRequestId must not alert again.
    created = false;
    await service.create(student, row.listing.id, {
      message: row.message,
      clientRequestId: "0f9c1f0a-0000-4000-8000-000000000005",
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(sent.length, 1);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_INQUIRIES_CHAT_ID;
    globalThis.fetch = originalFetch;
  }
});
