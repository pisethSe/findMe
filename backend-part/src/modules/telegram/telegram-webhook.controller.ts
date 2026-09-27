import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";

import { TelegramBotService } from "./telegram-bot.service.js";
import { TelegramWebhookGuard } from "./telegram-webhook.guard.js";

/**
 * Inbound update envelope. The body stays opaque here: the bot service reads
 * only the fields it needs, so an unexpected Telegram payload is ignored instead
 * of failing validation in a way that would make Telegram retry forever.
 */
export interface TelegramWebhookBody {
  [key: string]: unknown;
}

/**
 * Signed webhook for the administrator support bot. Telegram delivers updates
 * here only when `setWebhook` registered this URL together with the same secret
 * token; local development uses the polling transport instead.
 */
@Controller("telegram")
export class TelegramWebhookController {
  constructor(private readonly bot: TelegramBotService) {}

  @Post("webhook")
  @UseGuards(TelegramWebhookGuard)
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  async handleUpdate(@Body() update: TelegramWebhookBody) {
    await this.bot.handleUpdate(update);
    return { data: { accepted: true } };
  }
}
