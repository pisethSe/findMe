import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import {
  Prisma,
  type AnalyticsEventName,
} from "../../generated/prisma/client.js";
import { recordAnalyticsEvent } from "./analytics.events.js";

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  recordRead(events: AnalyticsEventName[]): Promise<void> {
    // Public reads remain useful when telemetry storage is contended or down.
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SET LOCAL statement_timeout = '200ms'`;
        for (const event of events)
          await recordAnalyticsEvent(transaction, event);
      },
      { maxWait: 200, timeout: 500 },
    );
  }

  summary(from: Date, to: Date) {
    return this.prisma.$queryRaw<
      { day: Date; event: AnalyticsEventName; count: bigint }[]
    >(Prisma.sql`
      SELECT day, event, count(*) AS count FROM analytics_events
      WHERE day >= ${from}::date AND day <= ${to}::date
      GROUP BY day, event ORDER BY day, event
    `);
  }
}
