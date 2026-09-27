import { Injectable, Logger } from "@nestjs/common";

const REQUEST_TIMEOUT_MS = 5000;
const LONG_POLL_GRACE_MS = 10_000;
const MAX_MESSAGE_CHARS = 3500;

interface TelegramApiPayload {
  ok?: boolean;
  result?: unknown;
}

/**
 * Bounded Bot API client for the administrator support bot.
 *
 * Every call fails closed: an unreachable or rejecting Telegram never throws
 * into HTTP request handling or the polling loop. Nothing here logs the bot
 * token, a chat id, or message content.
 */
@Injectable()
export class TelegramApiClient {
  private readonly logger = new Logger(TelegramApiClient.name);

  async sendMessage(input: {
    botToken: string;
    chatId: string;
    text: string;
  }): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${input.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: input.chatId,
            text: clampMessage(input.text),
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        this.logger.warn("TELEGRAM_SEND_FAILED: the reply was skipped.");
      }
      return response.ok;
    } catch {
      this.logger.warn("TELEGRAM_UNREACHABLE: the reply was skipped.");
      return false;
    }
  }

  /** Returns pending updates, or null when Telegram could not be reached. */
  async getUpdates(input: {
    botToken: string;
    offset: number;
    timeoutSeconds: number;
  }): Promise<unknown[] | null> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${input.botToken}/getUpdates`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            offset: input.offset,
            timeout: input.timeoutSeconds,
            allowed_updates: ["message"],
          }),
          signal: AbortSignal.timeout(
            (input.timeoutSeconds * 1000 + LONG_POLL_GRACE_MS) | 0,
          ),
        },
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as TelegramApiPayload;
      return Array.isArray(payload.result) ? payload.result : null;
    } catch {
      return null;
    }
  }
}

export function clampMessage(text: string): string {
  return text.length > MAX_MESSAGE_CHARS
    ? `${text.slice(0, MAX_MESSAGE_CHARS - 1)}…`
    : text;
}
