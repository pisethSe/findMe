import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL("../prisma/schema.prisma", import.meta.url);
const migrationUrl = new URL(
  "../prisma/migrations/20260902000100_initial/migration.sql",
  import.meta.url,
);
const listingContactMigrationUrl = new URL(
  "../prisma/migrations/20260904000100_listing_contact_preference/migration.sql",
  import.meta.url,
);
const landlordInquiryIndexMigrationUrl = new URL(
  "../prisma/migrations/20260904000200_landlord_inquiry_feed_index/migration.sql",
  import.meta.url,
);
const publicationFeedIndexMigrationUrl = new URL(
  "../prisma/migrations/20260904000300_publication_feed_index/migration.sql",
  import.meta.url,
);

test("canonical Prisma schema contains the required marketplace boundaries", async () => {
  const schema = await readFile(schemaUrl, "utf8");

  for (const model of [
    "User",
    "StudentProfile",
    "LandlordProfile",
    "LandlordEntitlement",
    "Institution",
    "Property",
    "Listing",
    "ListingImage",
    "Amenity",
    "Favorite",
    "Inquiry",
    "Report",
    "AuditLog",
    "RefreshSession",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }

  assert.match(schema, /property\s+Property\s+@relation\("PropertyListings"/);
  assert.match(schema, /Unsupported\("geography\(Point,4326\)"\)/g);
  assert.match(
    schema,
    /DRAFT\s+[\s\S]*PENDING_REVIEW[\s\S]*PUBLISHED[\s\S]*PAUSED[\s\S]*RENTED[\s\S]*REJECTED[\s\S]*ARCHIVED/,
  );
  assert.match(schema, /enum ContactPreference \{/);
  assert.match(
    schema,
    /contactPreference\s+ContactPreference\s+@default\(IN_APP_ONLY\)/,
  );
});

test("initial migration installs PostGIS and database-enforced invariants", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  for (const requiredSql of [
    'CREATE EXTENSION IF NOT EXISTS "postgis"',
    'CREATE UNIQUE INDEX "users_email_normalized_key"',
    'USING GIST ("location")',
    'CONSTRAINT "users_onboarding_role_check"',
    'CONSTRAINT "landlord_entitlements_trial_window_check"',
    'CREATE TRIGGER "landlord_entitlements_delete_trigger"',
    'CREATE TRIGGER "listings_capacity_trigger"',
    'CREATE TRIGGER "inquiries_valid_listing_trigger"',
    'FOREIGN KEY ("property_id", "landlord_id")',
    'PRIMARY KEY ("student_id","listing_id")',
  ]) {
    assert.ok(migration.includes(requiredSql), `missing SQL: ${requiredSql}`);
  }
});

test("listing contact migration adds a private-first contact policy", async () => {
  const migration = await readFile(listingContactMigrationUrl, "utf8");
  assert.match(migration, /CREATE TYPE "contact_preference" AS ENUM/);
  assert.match(
    migration,
    /ADD COLUMN "contact_preference" "contact_preference" NOT NULL DEFAULT 'in_app_only'/,
  );
});

test("landlord inquiry feed migration matches its filter and ordering", async () => {
  const migration = await readFile(landlordInquiryIndexMigrationUrl, "utf8");
  assert.match(
    migration,
    /ON "inquiries" \("landlord_id", "created_at" DESC, "id" DESC\)/,
  );
});

test("publication feed migration supports published search ordering", async () => {
  const migration = await readFile(publicationFeedIndexMigrationUrl, "utf8");
  assert.match(
    migration,
    /ON "listings" \("status", "published_at" DESC, "id"\)/,
  );
});
