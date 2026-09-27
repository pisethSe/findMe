import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../analytics/analytics.module.js";
import { TelegramApiClient } from "./telegram-api.client.js";
import { TelegramSupportRepository } from "./telegram-bot.repository.js";
import { TelegramBotService } from "./telegram-bot.service.js";
import { TelegramPollingService } from "./telegram-polling.service.js";
import { TelegramWebhookController } from "./telegram-webhook.controller.js";
import { TelegramWebhookGuard } from "./telegram-webhook.guard.js";

@Module({
  imports: [AnalyticsModule],
  controllers: [TelegramWebhookController],
  providers: [
    TelegramApiClient,
    TelegramSupportRepository,
    TelegramBotService,
    TelegramWebhookGuard,
    TelegramPollingService,
  ],
  exports: [TelegramBotService],
})
export class TelegramModule {}
