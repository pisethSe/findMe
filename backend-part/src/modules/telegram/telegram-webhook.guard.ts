import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

import {
  getAppEnvironment,
  getTelegramSupportConfig,
} from "../../config/environment.js";

/** Header Telegram sends with every webhook call when a secret token is set. */
export const TELEGRAM_WEBHOOK_SECRET_HEADER = "x-telegram-bot-api-secret-token";

function matchesSecret(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  );
}

/**
 * Telegram signs every webhook call with the secret token registered through
 * `setWebhook`. A disabled or secretless bot hides the route entirely, and a
 * mismatched secret is rejected before any update is parsed.
 */
@Injectable()
export class TelegramWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const config = getTelegramSupportConfig(
      process.env,
      getAppEnvironment(process.env.APP_ENV),
    );
    if (!config?.webhookSecret) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "The requested resource was not found.",
      });
    }

    const provided =
      context
        .switchToHttp()
        .getRequest<Request>()
        .header(TELEGRAM_WEBHOOK_SECRET_HEADER) ?? "";
    if (!matchesSecret(provided, config.webhookSecret)) {
      throw new UnauthorizedException({
        code: "TELEGRAM_WEBHOOK_UNAUTHORIZED",
        message: "A valid Telegram webhook secret is required.",
      });
    }

    return true;
  }
}
