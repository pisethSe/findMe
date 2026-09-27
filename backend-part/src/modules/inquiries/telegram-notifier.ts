import { Injectable, Logger } from "@nestjs/common";

import {
  getTelegramNotificationsConfig,
  type TelegramNotificationsConfig,
} from "../../config/environment.js";

const REQUEST_TIMEOUT_MS = 5000;
const MAX_MESSAGE_CHARS = 3500;

export interface NewInquiryNotification {
  inquiryId: string;
  listingId: string;
  listingSlug: string | null;
  titleKm: string | null;
  titleEn: string | null;
  message: string;
  createdAt: Date;
}

/** Plain-text body: student message is untrusted, so no markup is emitted. */
export function buildInquiryMessage(input: NewInquiryNotification): string {
  const title =
    input.titleEn?.trim() || input.titleKm?.trim() || input.listingSlug || "—";
  const text = [
    "New student inquiry",
    `Rental: ${title}`,
    `Inquiry: ${input.inquiryId}`,
    `Received: ${input.createdAt.toISOString()}`,
    "",
    input.message.trim(),
  ].join("\n");
  return text.length > MAX_MESSAGE_CHARS
    ? `${text.slice(0, MAX_MESSAGE_CHARS - 1)}…`
    : text;
}

/**
 * Best-effort Telegram alert for a newly created inquiry. Never throws and
 * never logs the bot token, chat ID, or message text: notification failure
 * must not fail the inquiry write or leak untrusted/private content.
 */
@Injectable()
export class TelegramNotifier {
  private readonly logger = new Logger(TelegramNotifier.name);
  private retryAfter = 0;

  config(): TelegramNotificationsConfig | null {
    return getTelegramNotificationsConfig(process.env);
  }

  async notifyNewInquiry(input: NewInquiryNotification): Promise<void> {
    const config = this.config();
    if (!config || Date.now() < this.retryAfter) return;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${config.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: config.inquiriesChatId,
            text: buildInquiryMessage(input),
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      if (!response.ok) this.backoff();
    } catch {
      // Never log the URL, token, chat ID, payload, or error details.
      this.backoff();
    }
  }

  private backoff(): void {
    // Suppress alert spam when Telegram is unavailable; recover automatically.
    this.retryAfter = Date.now() + 30_000;
    this.logger.warn("TELEGRAM_NOTIFY_UNAVAILABLE: retrying in 30 seconds.");
  }
}
