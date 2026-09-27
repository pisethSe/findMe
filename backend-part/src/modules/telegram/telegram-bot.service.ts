import { Injectable, Logger } from "@nestjs/common";

import {
  getAppEnvironment,
  getTelegramSupportConfig,
  type TelegramSupportConfig,
} from "../../config/environment.js";
import { AnalyticsService } from "../analytics/analytics.service.js";
import { TelegramApiClient } from "./telegram-api.client.js";
import { TelegramSupportRepository } from "./telegram-bot.repository.js";
import type {
  TelegramBotMessage,
  TelegramBotReply,
  TelegramBotUpdate,
  TelegramSupportCommand,
} from "./telegram-bot.types.js";

const DAY_MS = 86_400_000;
const DEFAULT_LIST_LIMIT = 5;
const MAX_LIST_LIMIT = 10;
const DEFAULT_STATS_DAYS = 7;
const MAX_STATS_DAYS = 31;
const MAX_ANSWERED_UPDATES = 200;
const MAX_TITLE_CHARS = 60;
const MAX_LABEL_CHARS = 40;

const HELP_REPLY = [
  "FindMe administrator bot",
  "",
  "/status — service and inventory summary",
  "/pending [1-10] — oldest rentals waiting for moderation",
  "/reports [1-10] — oldest open rental reports",
  "/stats [1-31] — anonymous activity totals for the last days",
  "/help — this list",
  "",
  "Moderation decisions stay in the signed-in admin console.",
].join("\n");

const NON_COMMAND_REPLY = "Send a command, for example /status or /help.";
const UNKNOWN_COMMAND_REPLY =
  "Unknown command. Send /help for the available commands.";
const FAILURE_REPLY =
  "The bot could not read that right now. Try again in a moment.";

function privateReply(senderId: number): string {
  return [
    "FindMe administrator bot",
    "",
    "This bot is private.",
    `Your Telegram user id is ${senderId}; an administrator must allow it first.`,
  ].join("\n");
}

/** Collapses whitespace so untrusted titles cannot forge extra reply lines. */
export function sanitizeLabel(value: string, maxChars: number): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) return "—";
  return collapsed.length > maxChars
    ? `${collapsed.slice(0, maxChars - 1)}…`
    : collapsed;
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

/**
 * Reads `/command@BotName argument` into a lower-case command name. Returns
 * null for anything that is not a command, which keeps plain chat text from
 * being treated as an instruction.
 */
export function parseTelegramCommand(
  text: string,
): TelegramSupportCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const [rawName = "", ...rest] = trimmed.slice(1).split(/\s+/);
  const name = rawName.split("@")[0]?.toLowerCase() ?? "";
  if (!/^[a-z]{1,32}$/.test(name)) return null;
  const argument = rest.join(" ").trim();
  return { name, argument: argument || null };
}

/**
 * Accepts an optional bounded integer argument. An absent argument uses the
 * default; a malformed or out-of-range value returns null so the bot can answer
 * with explicit usage instead of guessing.
 */
export function parseCommandArgument(
  argument: string | null,
  fallback: number,
  max: number,
): number | null {
  if (!argument) return fallback;
  if (!/^\d{1,3}$/.test(argument)) return null;
  const parsed = Number(argument);
  if (parsed < 1 || parsed > max) return null;
  return parsed;
}

export function extractTelegramMessage(
  update: unknown,
): TelegramBotMessage | null {
  if (typeof update !== "object" || update === null) return null;
  const message = (update as TelegramBotUpdate).message;
  if (typeof message !== "object" || message === null) return null;
  return message;
}

export function extractTelegramUpdateId(update: unknown): number | null {
  if (typeof update !== "object" || update === null) return null;
  const updateId = (update as TelegramBotUpdate).update_id;
  return typeof updateId === "number" && Number.isSafeInteger(updateId)
    ? updateId
    : null;
}

function isoDay(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}

/**
 * Administrator support bot. It answers a small, read-only command set for the
 * Telegram accounts listed in `TELEGRAM_SUPPORT_ADMIN_IDS`, and relies on the
 * existing admin API and moderation audit trail for every write: a chat message
 * can never approve, reject, suspend, or publish anything.
 */
@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly answeredUpdateIds: number[] = [];
  private readonly answeredUpdateIdSet = new Set<number>();

  constructor(
    private readonly repository: TelegramSupportRepository,
    private readonly analytics: AnalyticsService,
    private readonly api: TelegramApiClient,
  ) {}

  config(): TelegramSupportConfig | null {
    return getTelegramSupportConfig(
      process.env,
      getAppEnvironment(process.env.APP_ENV),
    );
  }

  /**
   * Reads one Telegram update and answers it. Telegram retries a webhook
   * delivery when a response was lost, so an update id is answered at most once
   * per process.
   */
  async handleUpdate(update: unknown): Promise<void> {
    const config = this.config();
    if (!config) return;
    const message = extractTelegramMessage(update);
    if (!message || message.from?.is_bot) return;
    if (this.wasAnswered(extractTelegramUpdateId(update))) return;

    const reply = await this.answer(config, message);
    if (!reply) return;
    await this.api.sendMessage({
      botToken: config.botToken,
      chatId: reply.chatId,
      text: reply.text,
    });
  }

  /**
   * Authorization and command routing. It never throws: an unexpected failure
   * returns a bounded retry message instead of leaking internals to the chat.
   */
  async answer(
    config: TelegramSupportConfig,
    message: TelegramBotMessage,
  ): Promise<TelegramBotReply | null> {
    const chatId = message.chat?.id;
    const senderId = message.from?.id;
    const text = message.text?.trim() ?? "";
    if (chatId === undefined || senderId === undefined || !text) return null;

    if (!config.adminUserIds.includes(String(senderId))) {
      return { chatId: String(chatId), text: privateReply(senderId) };
    }

    const command = parseTelegramCommand(text);
    if (!command) return { chatId: String(chatId), text: NON_COMMAND_REPLY };

    try {
      return {
        chatId: String(chatId),
        text: await this.runCommand(command, new Date()),
      };
    } catch {
      this.logger.warn(
        "TELEGRAM_SUPPORT_COMMAND_FAILED: the reply was skipped.",
      );
      return { chatId: String(chatId), text: FAILURE_REPLY };
    }
  }

  private async runCommand(
    command: TelegramSupportCommand,
    now: Date,
  ): Promise<string> {
    switch (command.name) {
      case "start":
      case "help":
        return HELP_REPLY;
      case "status":
        return this.statusReply(now);
      case "pending": {
        const limit = parseCommandArgument(
          command.argument,
          DEFAULT_LIST_LIMIT,
          MAX_LIST_LIMIT,
        );
        if (limit === null) return "Usage: /pending [1-10]";
        return this.pendingReply(limit, now);
      }
      case "reports": {
        const limit = parseCommandArgument(
          command.argument,
          DEFAULT_LIST_LIMIT,
          MAX_LIST_LIMIT,
        );
        if (limit === null) return "Usage: /reports [1-10]";
        return this.reportsReply(limit, now);
      }
      case "stats": {
        const days = parseCommandArgument(
          command.argument,
          DEFAULT_STATS_DAYS,
          MAX_STATS_DAYS,
        );
        if (days === null) return "Usage: /stats [1-31]";
        return this.statsReply(days, now);
      }
      default:
        return UNKNOWN_COMMAND_REPLY;
    }
  }

  private async statusReply(now: Date): Promise<string> {
    const checked = `Checked: ${now.toISOString()}`;
    if (!(await this.repository.isDatabaseReachable())) {
      return ["FindMe support status", "Database: unreachable", checked].join(
        "\n",
      );
    }

    const counts = await this.repository.counts();
    return [
      "FindMe support status",
      "Database: reachable",
      `Rentals awaiting moderation: ${counts.pendingListings}`,
      `Open reports: ${counts.openReports}`,
      `Published rentals: ${counts.publishedListings}`,
      `Active landlords: ${counts.activeLandlords}`,
      checked,
    ].join("\n");
  }

  private async pendingReply(limit: number, now: Date): Promise<string> {
    const rows = await this.repository.listPending(limit, now);
    if (rows.length === 0) return "No rental is waiting for moderation.";

    return [
      `Rentals awaiting moderation (oldest first; showing ${rows.length})`,
      ...rows.map(
        (row, index) =>
          `${index + 1}. ${sanitizeLabel(row.title, MAX_TITLE_CHARS)} — ${sanitizeLabel(row.landlordName, MAX_LABEL_CHARS)} — waiting ${row.waitingHours}h — id ${shortId(row.id)}`,
      ),
      "",
      "Approve or reject them in the admin console.",
    ].join("\n");
  }

  private async reportsReply(limit: number, now: Date): Promise<string> {
    const rows = await this.repository.listOpenReports(limit, now);
    if (rows.length === 0) return "No open rental report.";

    return [
      `Open rental reports (oldest first; showing ${rows.length})`,
      ...rows.map(
        (row, index) =>
          `${index + 1}. ${row.reason} — age ${row.ageHours}h — report ${shortId(row.id)} — rental ${shortId(row.listingId)}`,
      ),
      "",
      "Review and resolve them in the admin console.",
    ].join("\n");
  }

  private async statsReply(days: number, now: Date): Promise<string> {
    const to = isoDay(now);
    const from = isoDay(new Date(now.getTime() - (days - 1) * DAY_MS));
    const summary = await this.analytics.summary({ from, to });
    const active = summary.data.totals.filter(
      (total) => BigInt(total.count) > 0n,
    );
    const header = `Anonymous activity ${from} to ${to} (UTC, ${days} day(s))`;
    if (active.length === 0) {
      return `${header}\nNo activity was recorded in this window.`;
    }

    return [
      header,
      ...active.map((total) => `${total.event}: ${total.count}`),
    ].join("\n");
  }

  private wasAnswered(updateId: number | null): boolean {
    if (updateId === null) return false;
    if (this.answeredUpdateIdSet.has(updateId)) return true;

    this.answeredUpdateIdSet.add(updateId);
    this.answeredUpdateIds.push(updateId);
    while (this.answeredUpdateIds.length > MAX_ANSWERED_UPDATES) {
      const oldest = this.answeredUpdateIds.shift();
      if (oldest !== undefined) this.answeredUpdateIdSet.delete(oldest);
    }
    return false;
  }
}
