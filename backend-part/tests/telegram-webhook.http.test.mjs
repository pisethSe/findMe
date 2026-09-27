import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { ApiExceptionFilter } from "../dist/common/http/api-exception.filter.js";
import { TelegramBotService } from "../dist/modules/telegram/telegram-bot.service.js";
import { TelegramWebhookController } from "../dist/modules/telegram/telegram-webhook.controller.js";
import { TelegramWebhookGuard } from "../dist/modules/telegram/telegram-webhook.guard.js";

const BOT_TOKEN = `8679286143:${"A".repeat(35)}`;
const ADMIN_USER_ID = "1013974119";
const SECRET = "webhook-secret-with-at-least-16-chars";

class StubBotService {
  constructor() {
    this.updates = [];
  }

  async handleUpdate(update) {
    this.updates.push(update);
  }
}

test("the Telegram webhook is signed, hidden while disabled, and passes updates through", async () => {
  const previous = {
    APP_ENV: process.env.APP_ENV,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_SUPPORT_ADMIN_IDS: process.env.TELEGRAM_SUPPORT_ADMIN_IDS,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  };

  class HttpModule {}
  Module({
    controllers: [TelegramWebhookController],
    providers: [
      TelegramWebhookGuard,
      { provide: TelegramBotService, useClass: StubBotService },
    ],
  })(HttpModule);

  const app = await NestFactory.create(HttpModule, { logger: false });
  try {
    app.setGlobalPrefix("api/v1");
    // Mirror the production pipe: an opaque Telegram update must not be
    // rejected by field whitelisting.
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.listen(0, "127.0.0.1");

    const url = `${await app.getUrl()}/api/v1/telegram/webhook`;
    const post = (headers, body = {}) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      });

    process.env.APP_ENV = "test";
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;

    // A disabled support bot does not expose the route at all.
    delete process.env.TELEGRAM_SUPPORT_ADMIN_IDS;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const disabled = await post({});
    assert.equal(disabled.status, 404);
    assert.equal((await disabled.json()).error.code, "NOT_FOUND");

    // Enabled without a secret in a local/test environment means polling only.
    process.env.TELEGRAM_SUPPORT_ADMIN_IDS = ADMIN_USER_ID;
    assert.equal((await post({})).status, 404);

    // A signed deployment rejects a missing or wrong secret before parsing.
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
    const missing = await post({});
    assert.equal(missing.status, 401);
    assert.equal(
      (await missing.json()).error.code,
      "TELEGRAM_WEBHOOK_UNAUTHORIZED",
    );
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
    const wrong = await post({
      "x-telegram-bot-api-secret-token": `${SECRET}x`,
    });
    assert.equal(wrong.status, 401);

    // The matching secret accepts the update unchanged.
    const update = {
      update_id: 41,
      message: {
        message_id: 2,
        from: { id: Number(ADMIN_USER_ID), is_bot: false, first_name: "Se" },
        chat: { id: Number(ADMIN_USER_ID), type: "private" },
        text: "/status",
      },
    };
    const accepted = await post(
      { "x-telegram-bot-api-secret-token": SECRET },
      update,
    );
    assert.equal(accepted.status, 200);
    assert.equal(accepted.headers.get("cache-control"), "no-store");
    assert.deepEqual(await accepted.json(), { data: { accepted: true } });
    assert.deepEqual(app.get(TelegramBotService).updates, [update]);
  } finally {
    await app.close();
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
