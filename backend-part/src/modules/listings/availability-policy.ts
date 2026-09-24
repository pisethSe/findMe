import type { Prisma } from "../../generated/prisma/client.js";

const DAY_MS = 24 * 60 * 60 * 1_000;
export const AVAILABILITY_REMINDER_MS = 7 * DAY_MS;
export const AVAILABILITY_MAX_AGE_MS = 14 * DAY_MS;

export function availabilityCutoff(now = new Date()): Date {
  return new Date(now.getTime() - AVAILABILITY_MAX_AGE_MS);
}

export function evaluateAvailability(
  confirmedAt: Date | null,
  now = new Date(),
) {
  if (
    !confirmedAt ||
    !Number.isFinite(confirmedAt.getTime()) ||
    confirmedAt > now
  ) {
    return { state: "UNCONFIRMED" as const, remindAt: null, expiresAt: null };
  }
  const age = now.getTime() - confirmedAt.getTime();
  return {
    state:
      age >= AVAILABILITY_MAX_AGE_MS
        ? ("STALE" as const)
        : age >= AVAILABILITY_REMINDER_MS
          ? ("DUE" as const)
          : ("FRESH" as const),
    remindAt: new Date(
      confirmedAt.getTime() + AVAILABILITY_REMINDER_MS,
    ).toISOString(),
    expiresAt: new Date(
      confirmedAt.getTime() + AVAILABILITY_MAX_AGE_MS,
    ).toISOString(),
  };
}

export function hasCurrentAvailability(
  confirmedAt: Date | null,
  now = new Date(),
): boolean {
  const { state } = evaluateAvailability(confirmedAt, now);
  return state === "FRESH" || state === "DUE";
}

// Evaluate per request, never once at module load. Private history keeps its
// durable rows but exposes listing content only while it remains public.
export function publicListingWhere(now = new Date()): Prisma.ListingWhereInput {
  return {
    status: "PUBLISHED",
    deletedAt: null,
    availableUnits: { gt: 0 },
    publishedAt: { not: null },
    availabilityConfirmedAt: { gt: availabilityCutoff(now), lte: now },
    property: { deletedAt: null },
    landlord: { deletedAt: null, accountStatus: "ACTIVE" },
  };
}
