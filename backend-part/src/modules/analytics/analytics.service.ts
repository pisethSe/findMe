import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type { AnalyticsEventName } from "../../generated/prisma/client.js";
import type { AnalyticsSummaryQueryDto } from "./analytics.dto.js";
import { ANALYTICS_EVENTS } from "./analytics.events.js";
import { AnalyticsRepository } from "./analytics.repository.js";

const DAY_MS = 86_400_000;
type ReadEvent =
  "SEARCH_RESPONSE" | "SEARCH_ZERO_RESULTS" | "LISTING_DETAIL_RESPONSE";

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private retryAfter = 0;

  constructor(private readonly repository: AnalyticsRepository) {}

  async recordRead(events: ReadEvent[]): Promise<void> {
    if (Date.now() < this.retryAfter) return;
    try {
      await this.repository.recordRead(events);
    } catch {
      // Deliberate best-effort telemetry, with a cooldown and a redacted warning.
      // Never log database errors, URLs, request contents, or principal data.
      if (Date.now() >= this.retryAfter) {
        this.logger.warn(
          "Read analytics unavailable; counts may be incomplete. Retrying after 30 seconds.",
        );
      }
      this.retryAfter = Date.now() + 30_000;
    }
  }

  async summary(query: AnalyticsSummaryQueryDto) {
    const from = new Date(`${query.from}T00:00:00.000Z`);
    const to = new Date(`${query.to}T00:00:00.000Z`);
    const days = (to.getTime() - from.getTime()) / DAY_MS + 1;
    if (!Number.isInteger(days) || days < 1 || days > 31) {
      throw new BadRequestException({
        code: "ANALYTICS_DATE_RANGE_INVALID",
        message: "Choose an ordered date range of at most 31 days, inclusive.",
      });
    }
    const rows = await this.repository.summary(from, to);
    const totals = new Map<AnalyticsEventName, bigint>(
      ANALYTICS_EVENTS.map((event) => [event, 0n]),
    );
    const byDay = new Map(
      rows.map((row) => [
        `${row.day.toISOString().slice(0, 10)}:${row.event}`,
        row.count,
      ]),
    );
    const daily = Array.from({ length: days }, (_, offset) => {
      const day = new Date(from.getTime() + offset * DAY_MS)
        .toISOString()
        .slice(0, 10);
      return {
        day,
        events: ANALYTICS_EVENTS.map((event) => {
          const count = byDay.get(`${day}:${event}`) ?? 0n;
          totals.set(event, (totals.get(event) ?? 0n) + count);
          return { event, count: count.toString() };
        }),
      };
    });
    return {
      data: {
        totals: ANALYTICS_EVENTS.map((event) => ({
          event,
          count: (totals.get(event) ?? 0n).toString(),
        })),
        daily,
      },
      meta: {
        from: query.from,
        to: query.to,
        timezone: "UTC",
        days,
        readActivity: "API_RESPONSES_INCLUDING_REFRESHES",
      },
    };
  }
}
