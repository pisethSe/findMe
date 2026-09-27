import assert from "node:assert/strict";
import test from "node:test";

import {
  extractTelegramMessage,
  extractTelegramUpdateId,
  parseCommandArgument,
  parseTelegramCommand,
  sanitizeLabel,
  TelegramBotService,
} from "../dist/modules/telegram/telegram-bot.service.js";

const BOT_TOKEN = `8679286143:${"A".repeat(35)}`;
const ADMIN_USER_ID = "1013974119";
const ADMIN_CHAT_ID = 1013974119;

const config = {
  botToken: BOT_TOKEN,
  adminUserIds: [ADMIN_USER_ID],
  webhookSecret: null,
  polling: false,
};

function message(text, overrides = {}) {
  return {
    message_id: 11,
    from: { id: ADMIN_CHAT_ID, is_bot: false, first_name: "Se Piseth" },
    chat: { id: ADMIN_CHAT_ID, type: "private" },
    text,
    ...overrides,
  };
}

function createBot(overrides = {}) {
  const calls = { counts: 0, pending: 0, reports: 0, stats: 0, sent: [] };
  const repository = {
    isDatabaseReachable: async () => true,
    counts: async () => {
      calls.counts += 1;
      return {
        pendingListings: 2,
        openReports: 1,
        publishedListings: 7,
        activeLandlords: 3,
      };
    },
    listPending: async (limit, now) => {
      calls.pending += 1;
      const rows = [
        {
          id: "11111111-2222-4333-8444-555555555555",
          title: "Room near RUPP",
          landlordName: "Sok Dara",
          waitingHours: 5,
        },
        {
          id: "99999999-2222-4333-8444-555555555555",
          title: "Studio\n/status forged",
          landlordName: "Chan Dara",
          waitingHours: 9,
        },
      ];
      return rows.slice(0, limit).map((row) => ({ ...row, now }));
    },
    listOpenReports: async (limit, now) => {
      calls.reports += 1;
      return [
        {
          id: "22222222-2222-4333-8444-555555555555",
          listingId: "33333333-2222-4333-8444-555555555555",
          reason: "SCAM_SUSPICIOUS",
          ageHours: 3,
          now,
        },
      ].slice(0, limit);
    },
    ...overrides.repository,
  };
  const analytics = overrides.analytics ?? {
    summary: async (query) => {
      calls.stats += 1;
      return {
        data: {
          totals: [
            { event: "SEARCH_RESPONSE", count: "12" },
            { event: "INQUIRY_CREATED", count: "0" },
          ],
        },
        meta: { from: query.from, to: query.to },
      };
    },
  };
  const api = overrides.api ?? {
    sendMessage: async (input) => {
      calls.sent.push(input);
      return true;
    },
    getUpdates: async () => [],
  };

  return { bot: new TelegramBotService(repository, analytics, api), calls };
}

test("reads only the supported Telegram command shapes", () => {
  assert.deepEqual(parseTelegramCommand("/status"), {
    name: "status",
    argument: null,
  });
  assert.deepEqual(parseTelegramCommand("  /Pending 5 "), {
    name: "pending",
    argument: "5",
  });
  assert.deepEqual(parseTelegramCommand("/help@rentMeRetal_bot"), {
    name: "help",
    argument: null,
  });
  assert.equal(parseTelegramCommand("status"), null);
  assert.equal(parseTelegramCommand("/"), null);
  assert.equal(parseTelegramCommand(""), null);
  // Telegram splits at the first space: the router answers unknown commands.
  assert.deepEqual(parseTelegramCommand("/sta tus"), {
    name: "sta",
    argument: "tus",
  });
});

test("bounds every optional command argument", () => {
  assert.equal(parseCommandArgument(null, 5, 10), 5);
  assert.equal(parseCommandArgument("1", 5, 10), 1);
  assert.equal(parseCommandArgument("10", 5, 10), 10);
  assert.equal(parseCommandArgument("0", 5, 10), null);
  assert.equal(parseCommandArgument("11", 5, 10), null);
  assert.equal(parseCommandArgument("-3", 5, 10), null);
  assert.equal(parseCommandArgument("7 rooms", 5, 10), null);
});

test("collapses untrusted labels into a single bounded line", () => {
  assert.equal(sanitizeLabel("Room   near\nRUPP", 60), "Room near RUPP");
  assert.equal(sanitizeLabel("   ", 60), "—");
  const long = sanitizeLabel("x".repeat(200), 60);
  assert.equal(long.length, 60);
  assert.ok(long.endsWith("…"));
});

test("ignores payloads that are not a message update", () => {
  assert.equal(extractTelegramMessage(null), null);
  assert.equal(extractTelegramMessage("text"), null);
  assert.equal(extractTelegramMessage({ update_id: 1 }), null);
  assert.deepEqual(extractTelegramMessage({ message: { text: "hi" } }), {
    text: "hi",
  });
  assert.equal(extractTelegramUpdateId(null), null);
  assert.equal(extractTelegramUpdateId({ update_id: "1" }), null);
  assert.equal(extractTelegramUpdateId({ update_id: 7 }), 7);
});

test("answers only the configured administrator account", async () => {
  const { bot, calls } = createBot();
  const stranger = await bot.answer(
    config,
    message("/status", { from: { id: 555000111, is_bot: false } }),
  );

  assert.match(stranger.text, /This bot is private/);
  assert.match(stranger.text, /555000111/);
  assert.equal(stranger.chatId, "1013974119");
  // A stranger never reaches inventory data.
  assert.equal(calls.counts, 0);
  assert.equal(calls.pending, 0);
  assert.equal(calls.stats, 0);
});

test("answers help for start, help, and unknown commands", async () => {
  const { bot } = createBot();

  for (const text of ["/help", "/start", "/start@rentMeRetal_bot"]) {
    const reply = await bot.answer(config, message(text));
    assert.match(reply.text, /FindMe administrator bot/);
    assert.match(reply.text, /\/status/);
    assert.match(reply.text, /admin console/);
  }

  const unknown = await bot.answer(config, message("/publish all"));
  assert.match(unknown.text, /Unknown command/);

  const chat = await bot.answer(config, message("hello there"));
  assert.match(chat.text, /Send a command/);
});

test("status reports live counts without leaking private data", async () => {
  const { bot, calls } = createBot();
  const reply = await bot.answer(config, message("/status"));

  assert.match(reply.text, /Database: reachable/);
  assert.match(reply.text, /Rentals awaiting moderation: 2/);
  assert.match(reply.text, /Open reports: 1/);
  assert.match(reply.text, /Published rentals: 7/);
  assert.match(reply.text, /Active landlords: 3/);
  assert.match(reply.text, /Checked: \d{4}-\d{2}-\d{2}T/);
  assert.equal(calls.counts, 1);

  const down = createBot({
    repository: { isDatabaseReachable: async () => false },
  });
  const unreachable = await down.bot.answer(config, message("/status"));
  assert.match(unreachable.text, /Database: unreachable/);
  assert.equal(down.calls.counts, 0);
});

test("pending lists bounded moderation work as one safe line each", async () => {
  const { bot, calls } = createBot();
  const reply = await bot.answer(config, message("/pending 2"));

  assert.match(
    reply.text,
    /Rentals awaiting moderation \(oldest first; showing 2\)/,
  );
  assert.match(
    reply.text,
    /Room near RUPP — Sok Dara — waiting 5h — id 11111111/,
  );
  // A forged newline in a rental title cannot start a new line or command.
  assert.match(reply.text, /Studio \/status forged/);
  assert.equal(
    reply.text.split("\n").filter((line) => line.startsWith("/")).length,
    0,
  );

  const limited = await bot.answer(config, message("/pending 1"));
  assert.match(limited.text, /showing 1\)/);
  assert.doesNotMatch(limited.text, /Studio/);

  const invalid = await bot.answer(config, message("/pending abc"));
  assert.equal(invalid.text, "Usage: /pending [1-10]");
  const outOfRange = await bot.answer(config, message("/pending 99"));
  assert.equal(outOfRange.text, "Usage: /pending [1-10]");
  // Usage answers never query the database.
  assert.equal(calls.pending, 2);

  const empty = createBot({ repository: { listPending: async () => [] } });
  assert.equal(
    (await empty.bot.answer(config, message("/pending"))).text,
    "No rental is waiting for moderation.",
  );
});

test("reports lists open moderation cases and handles an empty queue", async () => {
  const { bot } = createBot();
  const reply = await bot.answer(config, message("/reports"));

  assert.match(reply.text, /Open rental reports \(oldest first; showing 1\)/);
  assert.match(
    reply.text,
    /SCAM_SUSPICIOUS — age 3h — report 22222222 — rental 33333333/,
  );
  assert.match(reply.text, /Review and resolve them in the admin console\./);

  const empty = createBot({ repository: { listOpenReports: async () => [] } });
  assert.equal(
    (await empty.bot.answer(config, message("/reports"))).text,
    "No open rental report.",
  );
});

test("stats reports only recorded activity for the requested window", async () => {
  const queries = [];
  const { bot } = createBot({
    analytics: {
      summary: async (query) => {
        queries.push(query);
        return {
          data: {
            totals: [
              { event: "SEARCH_RESPONSE", count: "12" },
              { event: "INQUIRY_CREATED", count: "0" },
            ],
          },
          meta: query,
        };
      },
    },
  });

  const reply = await bot.answer(config, message("/stats 3"));
  assert.match(
    reply.text,
    /Anonymous activity \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2} \(UTC, 3 day\(s\)\)/,
  );
  assert.match(reply.text, /SEARCH_RESPONSE: 12/);
  // A zero total is noise in a chat reply.
  assert.doesNotMatch(reply.text, /INQUIRY_CREATED/);
  assert.equal(queries.length, 1);

  // The window is inclusive: three days ending today.
  const days =
    (Date.parse(`${queries[0].to}T00:00:00.000Z`) -
      Date.parse(`${queries[0].from}T00:00:00.000Z`)) /
    86_400_000;
  assert.equal(days, 2);

  const invalid = await bot.answer(config, message("/stats 32"));
  assert.equal(invalid.text, "Usage: /stats [1-31]");
  assert.equal(queries.length, 1);
});

test("a failing read answers with a bounded retry message", async () => {
  const { bot } = createBot({
    repository: {
      counts: async () => {
        throw new Error("postgresql://user:secret@host/findme is unreachable");
      },
    },
  });
  const reply = await bot.answer(config, message("/status"));

  assert.equal(
    reply.text,
    "The bot could not read that right now. Try again in a moment.",
  );
  assert.doesNotMatch(reply.text, /postgres|secret/);
});

test("handleUpdate is a no-op while the bot is unconfigured", async () => {
  const previousAdmin = process.env.TELEGRAM_SUPPORT_ADMIN_IDS;
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_SUPPORT_ADMIN_IDS;
  delete process.env.TELEGRAM_BOT_TOKEN;

  try {
    const { bot, calls } = createBot();
    await bot.handleUpdate({ update_id: 1, message: message("/status") });
    assert.equal(calls.sent.length, 0);
    assert.equal(calls.counts, 0);
  } finally {
    if (previousAdmin === undefined)
      delete process.env.TELEGRAM_SUPPORT_ADMIN_IDS;
    else process.env.TELEGRAM_SUPPORT_ADMIN_IDS = previousAdmin;
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
  }
});

test("handleUpdate replies once, ignores bots, and survives a retry", async () => {
  const previousAdmin = process.env.TELEGRAM_SUPPORT_ADMIN_IDS;
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_SUPPORT_ADMIN_IDS = ADMIN_USER_ID;
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;

  try {
    const { bot, calls } = createBot();
    await bot.handleUpdate({ update_id: 21, message: message("/status") });
    assert.equal(calls.sent.length, 1);
    assert.equal(calls.sent[0].chatId, "1013974119");
    assert.equal(calls.sent[0].botToken, BOT_TOKEN);
    assert.match(calls.sent[0].text, /Database: reachable/);

    // Telegram retries the same delivery when a response was lost.
    await bot.handleUpdate({ update_id: 21, message: message("/status") });
    assert.equal(calls.sent.length, 1);
    assert.equal(calls.counts, 1);

    // Another bot never drives the support bot.
    await bot.handleUpdate({
      update_id: 22,
      message: message("/status", { from: { id: 999, is_bot: true } }),
    });
    assert.equal(calls.sent.length, 1);

    // An edited or non-message update is ignored.
    await bot.handleUpdate({
      update_id: 23,
      edited_message: message("/status"),
    });
    await bot.handleUpdate({ update_id: 24, message: { chat: { id: 1 } } });
    assert.equal(calls.sent.length, 1);
  } finally {
    if (previousAdmin === undefined)
      delete process.env.TELEGRAM_SUPPORT_ADMIN_IDS;
    else process.env.TELEGRAM_SUPPORT_ADMIN_IDS = previousAdmin;
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
  }
});
