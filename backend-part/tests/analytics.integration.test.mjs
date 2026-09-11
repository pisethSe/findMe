import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { config as loadEnvironment } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../dist/generated/prisma/client.js";
import { recordAnalyticsEvent } from "../dist/modules/analytics/analytics.events.js";
import { AnalyticsRepository } from "../dist/modules/analytics/analytics.repository.js";
import { AnalyticsService } from "../dist/modules/analytics/analytics.service.js";
import { FavoritesRepository } from "../dist/modules/favorites/favorites.repository.js";
import { InquiriesRepository } from "../dist/modules/inquiries/inquiries.repository.js";
import { ReportsRepository } from "../dist/modules/reports/reports.repository.js";
import { OnboardingRepository } from "../dist/modules/onboarding/onboarding.repository.js";
import { ListingsRepository } from "../dist/modules/listings/listings.repository.js";
import { ModerationRepository } from "../dist/modules/moderation/moderation.repository.js";

loadEnvironment({
  path: new URL("../../.env", import.meta.url).pathname,
  quiet: true,
});
const url = process.env.TEST_DATABASE_URL;

test(
  "concurrent serializable marketplace transactions do not contend on an analytics counter",
  { skip: !url, timeout: 10000 },
  async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    try {
      await Promise.all(
        Array.from({ length: 10 }, () =>
          prisma.$transaction(
            async (tx) => {
              await tx.$queryRaw`SELECT 1 AS snapshot`;
              await new Promise((resolve) => setTimeout(resolve, 50));
              await recordAnalyticsEvent(tx, "LISTING_DETAIL_RESPONSE");
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          ),
        ),
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);

test(
  "real transactions count actual engagement/supply transitions once and roll back with marketplace state",
  { skip: !url, timeout: 20000 },
  async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    const rollback = new Error("Rollback isolated analytics fixtures");
    try {
      await assert.rejects(
        prisma.$transaction(
          async (tx) => {
            // Isolate only the event table while exercising the actual repositories,
            // constraints and marketplace tables. Parallel suites cannot affect totals.
            await tx.$executeRaw`CREATE TEMP TABLE analytics_events (LIKE public.analytics_events INCLUDING ALL) ON COMMIT DROP`;
            await tx.$executeRaw`SET LOCAL search_path = pg_temp, public`;
            const client = new Proxy(tx, {
              get(target, key) {
                if (key === "$transaction") return (work) => work(tx);
                return Reflect.get(target, key);
              },
            });
            const count = async (event) => {
              const rows =
                await tx.$queryRaw`SELECT count(*) AS count FROM analytics_events WHERE event::text=${event}`;
              return rows[0]?.count ?? 0n;
            };
            const makeUser = (role = null) =>
              tx.user.create({
                data: {
                  email: `${randomUUID()}@example.test`,
                  passwordHash: "private-hash",
                  role,
                  ...(role ? { onboardingCompletedAt: new Date() } : {}),
                },
              });
            const student = await makeUser();
            const landlord = await makeUser();
            const admin = await makeUser("ADMIN");
            const onboarding = new OnboardingRepository(client);
            const now = new Date();
            for (let i = 0; i < 2; i++) {
              await onboarding.selectRole(
                student.id,
                "STUDENT",
                "Private Student",
                now,
              );
              await onboarding.selectRole(
                landlord.id,
                "LANDLORD",
                undefined,
                now,
              );
              await onboarding.activateLandlord(
                landlord.id,
                { displayName: "Private Owner", contactPhone: "+85512345678" },
                now,
                new Date(now.getTime() + 604800000),
              );
            }
            assert.equal(await count("STUDENT_ROLE_SELECTED"), 1n);
            assert.equal(await count("LANDLORD_ROLE_SELECTED"), 1n);
            assert.equal(await count("LANDLORD_TRIAL_STARTED"), 1n);
            const listings = new ListingsRepository(client);
            const listing = await listings.create({
              landlordId: landlord.id,
              slug: randomUUID(),
              property: {
                name: "Private rental",
                addressLine: "Private address",
                latitude: 11.57,
                longitude: 104.89,
                totalUnits: 2,
              },
              listing: {
                titleEn: "Rental",
                descriptionEn: "Rental description",
                propertyType: "ROOM",
                monthlyPrice: 100,
                currency: "USD",
                availableUnits: 1,
                availabilityConfirmedAt: now,
                contactPreference: "IN_APP_ONLY",
              },
              amenityIds: [],
            });
            assert.equal(await count("LISTING_CREATED"), 1n);
            await tx.listingImage.create({
              data: {
                listingId: listing.id,
                storageKey: randomUUID(),
                publicUrl: "https://example.test/photo.jpg",
                status: "READY",
              },
            });
            await listings.transition(listing.id, landlord.id, "DRAFT", {
              status: "PENDING_REVIEW",
            });
            assert.equal(
              await listings.transition(listing.id, landlord.id, "DRAFT", {
                status: "PENDING_REVIEW",
              }),
              null,
            );
            assert.equal(await count("LISTING_SUBMITTED"), 1n);
            const moderation = new ModerationRepository(client);
            await moderation.approve(listing.id, admin.id, now);
            assert.equal(
              await moderation.approve(listing.id, admin.id, now),
              null,
            );
            assert.equal(await count("LISTING_PUBLISHED"), 1n);
            const favorites = new FavoritesRepository(client);
            await favorites.save(student.id, listing.id);
            await favorites.save(student.id, listing.id);
            assert.equal(await count("FAVORITE_SAVED"), 1n);
            await favorites.remove(student.id, listing.id);
            await favorites.remove(student.id, listing.id);
            assert.equal(await count("FAVORITE_REMOVED"), 1n);
            const limiter = {
              isLimited: async () => false,
              record: async () => undefined,
            };
            const inquiries = new InquiriesRepository(client, limiter);
            const input = {
              message: "Private student contact and inquiry",
              clientRequestId: randomUUID(),
            };
            await inquiries.create(student.id, listing.id, input);
            await inquiries.create(student.id, listing.id, input);
            assert.equal(await count("INQUIRY_CREATED"), 1n);
            const reports = new ReportsRepository(client, limiter);
            await reports.create(student.id, listing.id, {
              reason: "OTHER",
              details: "Private report",
            });
            await reports.create(student.id, listing.id, {
              reason: "OTHER",
              details: "Private retry",
            });
            assert.equal(await count("REPORT_CREATED"), 1n);
            await tx.$executeRaw`SAVEPOINT analytics_rollback`;
            await favorites.save(student.id, listing.id);
            assert.equal(await count("FAVORITE_SAVED"), 2n);
            await tx.$executeRaw`ROLLBACK TO SAVEPOINT analytics_rollback`;
            assert.equal(await count("FAVORITE_SAVED"), 1n);
            assert.equal(
              await tx.favorite.count({ where: { studentId: student.id } }),
              0,
            );
            await listings.transition(listing.id, landlord.id, "PUBLISHED", {
              status: "PAUSED",
            });
            await assert.rejects(favorites.save(student.id, listing.id));
            assert.equal(await count("FAVORITE_SAVED"), 1n);
            await listings.transition(listing.id, landlord.id, "PAUSED", {
              status: "PENDING_REVIEW",
            });
            await moderation.reject(
              listing.id,
              admin.id,
              "Private moderation note",
            );
            assert.equal(
              await moderation.reject(listing.id, admin.id, "Retry"),
              null,
            );
            assert.equal(await count("LISTING_REJECTED"), 1n);
            await recordAnalyticsEvent(tx, "SEARCH_RESPONSE");
            await recordAnalyticsEvent(tx, "SEARCH_RESPONSE");
            assert.equal(await count("SEARCH_RESPONSE"), 2n);
            const rows = await tx.$queryRaw`SELECT * FROM analytics_events`;
            assert.deepEqual(Object.keys(rows[0]).sort(), [
              "day",
              "event",
              "id",
            ]);
            const [clock] =
              await tx.$queryRaw`SELECT (clock_timestamp() AT TIME ZONE 'UTC')::date AS day`;
            assert.ok(
              rows.every((row) => row.day.getTime() === clock.day.getTime()),
            );
            const day = clock.day.toISOString().slice(0, 10);
            const summary = await new AnalyticsService(
              new AnalyticsRepository(client),
            ).summary({ from: day, to: day });
            assert.equal(
              summary.data.totals.find((row) => row.event === "SEARCH_RESPONSE")
                .count,
              "2",
            );
            assert.equal(
              summary.data.totals.find((row) => row.event === "INQUIRY_CREATED")
                .count,
              "1",
            );
            await tx.$executeRaw`SAVEPOINT analytics_constraints`;
            await assert.rejects(
              tx.$executeRaw`INSERT INTO analytics_events(event) VALUES ('FORGED')`,
            );
            await tx.$executeRaw`ROLLBACK TO SAVEPOINT analytics_constraints`;
            throw rollback;
          },
          { timeout: 15000 },
        ),
        (error) => error === rollback,
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);
