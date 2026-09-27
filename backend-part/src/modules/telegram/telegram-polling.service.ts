import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";

import {
  getAppEnvironment,
  getTelegramSupportConfig,
  type TelegramSupportConfig,
} from "../../config/environment.js";
import { TelegramApiClient } from "./telegram-api.client.js";
import {
  extractTelegramUpdateId,
  TelegramBotService,
} from "./telegram-bot.service.js";

const POLL_TIMEOUT_SECONDS = 25;
const RETRY_DELAY_MS = 5000;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Local development transport for the administrator bot: it long-polls
 * `getUpdates` while `TELEGRAM_SUPPORT_POLLING=true`.
 *
 * A bot owns one update cursor, so Telegram serves either the webhook or long
 * polling, never both; deployment configuration therefore rejects polling in
 * staging and production. The loop is detached from request handling, confirms
 * each update through the offset, and stops on shutdown.
 */
@Injectable()
export class TelegramPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollingService.name);
  private stopped = false;
  private offset = 0;

  constructor(
    private readonly bot: TelegramBotService,
    private readonly api: TelegramApiClient,
  ) {}

  onModuleInit(): void {
    const config = getTelegramSupportConfig(
      process.env,
      getAppEnvironment(process.env.APP_ENV),
    );
    if (!config?.polling) return;

    this.logger.log("Telegram support bot polling started.");
    void this.poll(config);
  }

  onModuleDestroy(): void {
    this.stopped = true;
  }

  private async poll(config: TelegramSupportConfig): Promise<void> {
    while (!this.stopped) {
      const updates = await this.api.getUpdates({
        botToken: config.botToken,
        offset: this.offset,
        timeoutSeconds: POLL_TIMEOUT_SECONDS,
      });
      if (this.stopped) return;
      if (updates === null) {
        await delay(RETRY_DELAY_MS);
        continue;
      }

      for (const update of updates) {
        const updateId = extractTelegramUpdateId(update);
        if (updateId !== null && updateId >= this.offset) {
          this.offset = updateId + 1;
        }
        await this.bot.handleUpdate(update);
      }
    }
  }
}
