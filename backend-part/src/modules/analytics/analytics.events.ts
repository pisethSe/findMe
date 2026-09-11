import { AnalyticsEventName, Prisma } from "../../generated/prisma/client.js";

export const ANALYTICS_EVENTS = Object.values(AnalyticsEventName);

// No actor, resource, request, location, or free-text fields are accepted.
// Call within the marketplace transaction, after a real state change, so
// rollbacks and idempotent retries cannot produce phantom conversions.
export async function recordAnalyticsEvent(
  transaction: Prisma.TransactionClient,
  event: AnalyticsEventName,
): Promise<void> {
  await transaction.$executeRaw(Prisma.sql`
    INSERT INTO analytics_events (event)
    VALUES (${event}::analytics_event_name)
  `);
}
