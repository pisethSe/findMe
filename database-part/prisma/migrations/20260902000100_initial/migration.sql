-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- Required by the canonical geographic model. Neon supports PostGIS, and local
-- development uses the postgis/postgis image defined in deploy-part/compose.yaml.
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('student', 'landlord', 'admin');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "preferred_locale" AS ENUM ('km', 'en');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('unverified', 'pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "entitlement_status" AS ENUM ('trialing', 'active', 'expired', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "entitlement_source" AS ENUM ('trial', 'admin_grant', 'subscription');

-- CreateEnum
CREATE TYPE "institution_type" AS ENUM ('university', 'college', 'school', 'other');

-- CreateEnum
CREATE TYPE "property_type" AS ENUM ('room', 'studio', 'apartment', 'house', 'dorm_room', 'other_student_rental');

-- CreateEnum
CREATE TYPE "currency" AS ENUM ('USD', 'KHR');

-- CreateEnum
CREATE TYPE "listing_status" AS ENUM ('draft', 'pending_review', 'published', 'paused', 'rented', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "image_status" AS ENUM ('uploading', 'ready', 'failed', 'removed');

-- CreateEnum
CREATE TYPE "inquiry_status" AS ENUM ('new', 'read', 'responded', 'closed');

-- CreateEnum
CREATE TYPE "report_reason" AS ENUM ('inaccurate', 'unavailable', 'scam_suspicious', 'duplicate', 'inappropriate', 'other');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('open', 'in_review', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320),
    "phone" VARCHAR(32),
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "user_role",
    "account_status" "account_status" NOT NULL DEFAULT 'active',
    "preferred_locale" "preferred_locale" NOT NULL DEFAULT 'km',
    "onboarding_completed_at" TIMESTAMPTZ(3),
    "email_verified_at" TIMESTAMPTZ(3),
    "phone_verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "institution_id" UUID,
    "preferred_radius_meters" INTEGER,
    "preferred_min_price" DECIMAL(12,2),
    "preferred_max_price" DECIMAL(12,2),
    "preferred_price_currency" "currency",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "landlord_profiles" (
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "business_name" VARCHAR(160),
    "contact_phone" VARCHAR(32) NOT NULL,
    "contact_telegram" VARCHAR(80),
    "verification_status" "verification_status" NOT NULL DEFAULT 'unverified',
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landlord_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "landlord_entitlements" (
    "landlord_id" UUID NOT NULL,
    "status" "entitlement_status" NOT NULL,
    "source" "entitlement_source" NOT NULL,
    "trial_started_at" TIMESTAMPTZ(3),
    "trial_ends_at" TIMESTAMPTZ(3),
    "access_ends_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landlord_entitlements_pkey" PRIMARY KEY ("landlord_id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(160) NOT NULL,
    "name_km" VARCHAR(200) NOT NULL,
    "name_en" VARCHAR(200) NOT NULL,
    "short_name" VARCHAR(40),
    "type" "institution_type" NOT NULL,
    "address_km" VARCHAR(500),
    "address_en" VARCHAR(500),
    "city" VARCHAR(120) NOT NULL DEFAULT 'Phnom Penh',
    "country_code" CHAR(2) NOT NULL DEFAULT 'KH',
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "location" geography(Point,4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography
    ) STORED,
    "google_place_id" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "landlord_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "address_line" VARCHAR(500) NOT NULL,
    "commune" VARCHAR(120),
    "district" VARCHAR(120),
    "city" VARCHAR(120) NOT NULL DEFAULT 'Phnom Penh',
    "country_code" CHAR(2) NOT NULL DEFAULT 'KH',
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "location" geography(Point,4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography
    ) STORED,
    "google_place_id" VARCHAR(255),
    "total_units" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "landlord_id" UUID NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "title_km" VARCHAR(200),
    "title_en" VARCHAR(200),
    "description_km" TEXT,
    "description_en" TEXT,
    "property_type" "property_type" NOT NULL,
    "monthly_price" DECIMAL(12,2) NOT NULL,
    "currency" "currency" NOT NULL,
    "deposit_amount" DECIMAL(12,2),
    "utility_notes_km" TEXT,
    "utility_notes_en" TEXT,
    "house_rules_km" TEXT,
    "house_rules_en" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "furnished" BOOLEAN NOT NULL DEFAULT false,
    "available_from" DATE,
    "available_units" INTEGER NOT NULL,
    "availability_confirmed_at" TIMESTAMPTZ(3),
    "status" "listing_status" NOT NULL DEFAULT 'draft',
    "moderation_note" TEXT,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "listing_id" UUID NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "public_url" VARCHAR(1000) NOT NULL,
    "alt_text_km" VARCHAR(300),
    "alt_text_en" VARCHAR(300),
    "width" INTEGER,
    "height" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "image_status" NOT NULL DEFAULT 'uploading',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(80) NOT NULL,
    "name_km" VARCHAR(120) NOT NULL,
    "name_en" VARCHAR(120) NOT NULL,
    "category" VARCHAR(80),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_amenities" (
    "listing_id" UUID NOT NULL,
    "amenity_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_amenities_pkey" PRIMARY KEY ("listing_id","amenity_id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "student_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("student_id","listing_id")
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "listing_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "landlord_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "status" "inquiry_status" NOT NULL DEFAULT 'new',
    "read_at" TIMESTAMPTZ(3),
    "responded_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "listing_id" UUID NOT NULL,
    "reporter_id" UUID,
    "reason" "report_reason" NOT NULL,
    "details" TEXT,
    "status" "report_status" NOT NULL DEFAULT 'open',
    "resolved_by_id" UUID,
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "ip_hash" VARCHAR(128),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "user_agent" VARCHAR(500),
    "ip_hash" VARCHAR(128),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Authentication normalizes email addresses, and this expression index keeps
-- that uniqueness invariant true even for direct database writes.
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users" (LOWER("email"));

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "student_profiles_institution_id_idx" ON "student_profiles"("institution_id");

-- CreateIndex
CREATE INDEX "landlord_entitlements_status_access_ends_at_idx" ON "landlord_entitlements"("status", "access_ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_slug_key" ON "institutions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_google_place_id_key" ON "institutions"("google_place_id");

-- CreateIndex
CREATE INDEX "institutions_is_active_name_en_idx" ON "institutions"("is_active", "name_en");

-- PostGIS indexes support institution-radius and map-viewport search.
CREATE INDEX "institutions_location_gist_idx" ON "institutions" USING GIST ("location");

-- CreateIndex
CREATE INDEX "properties_landlord_id_deleted_at_idx" ON "properties"("landlord_id", "deleted_at");

CREATE INDEX "properties_location_gist_idx" ON "properties" USING GIST ("location");

-- CreateIndex
CREATE UNIQUE INDEX "properties_id_landlord_id_key" ON "properties"("id", "landlord_id");

-- CreateIndex
CREATE UNIQUE INDEX "listings_slug_key" ON "listings"("slug");

-- CreateIndex
CREATE INDEX "listings_property_id_idx" ON "listings"("property_id");

-- CreateIndex
CREATE INDEX "listings_landlord_id_status_deleted_at_idx" ON "listings"("landlord_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "listings_status_available_units_monthly_price_idx" ON "listings"("status", "available_units", "monthly_price");

-- CreateIndex
CREATE UNIQUE INDEX "listings_id_landlord_id_key" ON "listings"("id", "landlord_id");

-- CreateIndex
CREATE UNIQUE INDEX "listing_images_storage_key_key" ON "listing_images"("storage_key");

-- CreateIndex
CREATE INDEX "listing_images_listing_id_status_idx" ON "listing_images"("listing_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "listing_images_listing_id_sort_order_key" ON "listing_images"("listing_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_key_key" ON "amenities"("key");

-- CreateIndex
CREATE INDEX "amenities_is_active_sort_order_idx" ON "amenities"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "listing_amenities_amenity_id_idx" ON "listing_amenities"("amenity_id");

-- CreateIndex
CREATE INDEX "favorites_listing_id_idx" ON "favorites"("listing_id");

-- CreateIndex
CREATE INDEX "inquiries_student_id_created_at_idx" ON "inquiries"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "inquiries_landlord_id_status_created_at_idx" ON "inquiries"("landlord_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "inquiries_listing_id_idx" ON "inquiries"("listing_id");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_listing_id_idx" ON "reports"("listing_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_expires_at_idx" ON "refresh_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landlord_profiles" ADD CONSTRAINT "landlord_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landlord_entitlements" ADD CONSTRAINT "landlord_entitlements_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_landlord_id_fkey" FOREIGN KEY ("property_id", "landlord_id") REFERENCES "properties"("id", "landlord_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_amenities" ADD CONSTRAINT "listing_amenities_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_amenities" ADD CONSTRAINT "listing_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_listing_id_landlord_id_fkey" FOREIGN KEY ("listing_id", "landlord_id") REFERENCES "listings"("id", "landlord_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Scalar invariants that should remain true regardless of the application path.
ALTER TABLE "users"
    ADD CONSTRAINT "users_contact_required_check" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL),
    ADD CONSTRAINT "users_onboarding_role_check" CHECK (
        ("role" IS NULL AND "onboarding_completed_at" IS NULL)
        OR ("role" IS NOT NULL AND "onboarding_completed_at" IS NOT NULL)
    );

ALTER TABLE "student_profiles"
    ADD CONSTRAINT "student_profiles_radius_check" CHECK (
        "preferred_radius_meters" IS NULL OR "preferred_radius_meters" BETWEEN 100 AND 50000
    ),
    ADD CONSTRAINT "student_profiles_price_check" CHECK (
        ("preferred_min_price" IS NULL OR "preferred_min_price" >= 0)
        AND ("preferred_max_price" IS NULL OR "preferred_max_price" >= 0)
        AND (
            "preferred_min_price" IS NULL
            OR "preferred_max_price" IS NULL
            OR "preferred_min_price" <= "preferred_max_price"
        )
    );

ALTER TABLE "landlord_profiles"
    ADD CONSTRAINT "landlord_profiles_verification_check" CHECK (
        ("verification_status" = 'verified' AND "verified_at" IS NOT NULL)
        OR ("verification_status" <> 'verified' AND "verified_at" IS NULL)
    );

ALTER TABLE "landlord_entitlements"
    ADD CONSTRAINT "landlord_entitlements_trial_window_check" CHECK (
        ("trial_started_at" IS NULL AND "trial_ends_at" IS NULL)
        OR (
            "trial_started_at" IS NOT NULL
            AND "trial_ends_at" = "trial_started_at" + INTERVAL '7 days'
        )
    ),
    ADD CONSTRAINT "landlord_entitlements_trial_source_check" CHECK (
        "source" <> 'trial'
        OR (
            "trial_started_at" IS NOT NULL
            AND "trial_ends_at" IS NOT NULL
            AND "access_ends_at" = "trial_ends_at"
        )
    );

ALTER TABLE "institutions"
    ADD CONSTRAINT "institutions_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
    ADD CONSTRAINT "institutions_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180),
    ADD CONSTRAINT "institutions_country_code_check" CHECK ("country_code" ~ '^[A-Z]{2}$');

ALTER TABLE "properties"
    ADD CONSTRAINT "properties_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
    ADD CONSTRAINT "properties_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180),
    ADD CONSTRAINT "properties_country_code_check" CHECK ("country_code" ~ '^[A-Z]{2}$'),
    ADD CONSTRAINT "properties_total_units_check" CHECK ("total_units" > 0);

ALTER TABLE "listings"
    ADD CONSTRAINT "listings_title_required_check" CHECK (
        NULLIF(BTRIM("title_km"), '') IS NOT NULL OR NULLIF(BTRIM("title_en"), '') IS NOT NULL
    ),
    ADD CONSTRAINT "listings_monthly_price_check" CHECK ("monthly_price" > 0),
    ADD CONSTRAINT "listings_deposit_amount_check" CHECK ("deposit_amount" IS NULL OR "deposit_amount" >= 0),
    ADD CONSTRAINT "listings_bedrooms_check" CHECK ("bedrooms" IS NULL OR "bedrooms" >= 0),
    ADD CONSTRAINT "listings_bathrooms_check" CHECK ("bathrooms" IS NULL OR "bathrooms" >= 0),
    ADD CONSTRAINT "listings_available_units_check" CHECK ("available_units" >= 0),
    ADD CONSTRAINT "listings_published_metadata_check" CHECK (
        "status" <> 'published'
        OR ("published_at" IS NOT NULL AND "availability_confirmed_at" IS NOT NULL)
    );

ALTER TABLE "listing_images"
    ADD CONSTRAINT "listing_images_dimensions_check" CHECK (
        ("width" IS NULL AND "height" IS NULL)
        OR ("width" > 0 AND "height" > 0)
    ),
    ADD CONSTRAINT "listing_images_sort_order_check" CHECK ("sort_order" >= 0);

ALTER TABLE "amenities"
    ADD CONSTRAINT "amenities_sort_order_check" CHECK ("sort_order" >= 0);

ALTER TABLE "inquiries"
    ADD CONSTRAINT "inquiries_message_check" CHECK (
        CHAR_LENGTH(BTRIM("message")) BETWEEN 1 AND 4000
    ),
    ADD CONSTRAINT "inquiries_status_timestamps_check" CHECK (
        ("read_at" IS NULL OR "status" IN ('read', 'responded', 'closed'))
        AND ("responded_at" IS NULL OR "status" IN ('responded', 'closed'))
        AND ("closed_at" IS NULL OR "status" = 'closed')
    );

ALTER TABLE "reports"
    ADD CONSTRAINT "reports_resolution_check" CHECK (
        ("status" IN ('resolved', 'dismissed') AND "resolved_by_id" IS NOT NULL AND "resolved_at" IS NOT NULL)
        OR ("status" NOT IN ('resolved', 'dismissed') AND "resolved_by_id" IS NULL AND "resolved_at" IS NULL)
    );

ALTER TABLE "refresh_sessions"
    ADD CONSTRAINT "refresh_sessions_expiry_check" CHECK ("expires_at" > "created_at");

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_expiry_check" CHECK ("expires_at" > "created_at");

-- Users cannot silently overwrite an established onboarding role. ADMIN may be
-- inserted only by a privileged database/server process and is immutable too.
CREATE OR REPLACE FUNCTION "enforce_user_role_immutability"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."role" IS NOT NULL AND NEW."role" IS DISTINCT FROM OLD."role" THEN
        RAISE EXCEPTION 'an established user role cannot be changed'
            USING ERRCODE = '23514', CONSTRAINT = 'users_role_immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "users_role_immutable_trigger"
BEFORE UPDATE OF "role" ON "users"
FOR EACH ROW EXECUTE FUNCTION "enforce_user_role_immutability"();

-- Role-owned records are checked inside PostgreSQL as a second line of defense.
CREATE OR REPLACE FUNCTION "require_user_role"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    expected_role "user_role" := TG_ARGV[0]::"user_role";
    user_column TEXT := TG_ARGV[1];
    target_user_id UUID;
    actual_role "user_role";
BEGIN
    target_user_id := (to_jsonb(NEW) ->> user_column)::UUID;
    SELECT "role" INTO actual_role FROM "users" WHERE "id" = target_user_id;

    IF actual_role IS DISTINCT FROM expected_role THEN
        RAISE EXCEPTION 'user % must have role %', target_user_id, expected_role
            USING ERRCODE = '23514', CONSTRAINT = TG_NAME;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "student_profiles_student_role_trigger"
BEFORE INSERT OR UPDATE OF "user_id" ON "student_profiles"
FOR EACH ROW EXECUTE FUNCTION "require_user_role"('student', 'user_id');

CREATE TRIGGER "landlord_profiles_landlord_role_trigger"
BEFORE INSERT OR UPDATE OF "user_id" ON "landlord_profiles"
FOR EACH ROW EXECUTE FUNCTION "require_user_role"('landlord', 'user_id');

CREATE TRIGGER "landlord_entitlements_landlord_role_trigger"
BEFORE INSERT OR UPDATE OF "landlord_id" ON "landlord_entitlements"
FOR EACH ROW EXECUTE FUNCTION "require_user_role"('landlord', 'landlord_id');

CREATE TRIGGER "properties_landlord_role_trigger"
BEFORE INSERT OR UPDATE OF "landlord_id" ON "properties"
FOR EACH ROW EXECUTE FUNCTION "require_user_role"('landlord', 'landlord_id');

CREATE TRIGGER "listings_landlord_role_trigger"
BEFORE INSERT OR UPDATE OF "landlord_id" ON "listings"
FOR EACH ROW EXECUTE FUNCTION "require_user_role"('landlord', 'landlord_id');

CREATE TRIGGER "favorites_student_role_trigger"
BEFORE INSERT OR UPDATE OF "student_id" ON "favorites"
FOR EACH ROW EXECUTE FUNCTION "require_user_role"('student', 'student_id');

CREATE TRIGGER "inquiries_student_role_trigger"
BEFORE INSERT OR UPDATE OF "student_id" ON "inquiries"
FOR EACH ROW EXECUTE FUNCTION "require_user_role"('student', 'student_id');

CREATE TRIGGER "inquiries_landlord_role_trigger"
BEFORE INSERT OR UPDATE OF "landlord_id" ON "inquiries"
FOR EACH ROW EXECUTE FUNCTION "require_user_role"('landlord', 'landlord_id');

-- Once trial timestamps exist they cannot be replaced, extended, or cleared.
-- The entitlement row itself is retained as the durable one-time-trial record.
CREATE OR REPLACE FUNCTION "protect_landlord_trial"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'landlord entitlement history cannot be deleted'
            USING ERRCODE = '23514', CONSTRAINT = 'landlord_entitlement_history_required';
    END IF;

    IF OLD."trial_started_at" IS NOT NULL AND (
        NEW."trial_started_at" IS DISTINCT FROM OLD."trial_started_at"
        OR NEW."trial_ends_at" IS DISTINCT FROM OLD."trial_ends_at"
    ) THEN
        RAISE EXCEPTION 'landlord trial timestamps are immutable'
            USING ERRCODE = '23514', CONSTRAINT = 'landlord_trial_immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "landlord_entitlements_trial_update_trigger"
BEFORE UPDATE ON "landlord_entitlements"
FOR EACH ROW EXECUTE FUNCTION "protect_landlord_trial"();

CREATE TRIGGER "landlord_entitlements_delete_trigger"
BEFORE DELETE ON "landlord_entitlements"
FOR EACH ROW EXECUTE FUNCTION "protect_landlord_trial"();

-- A listing cannot advertise more available units than its property owns, and
-- reducing property capacity cannot invalidate existing listings.
CREATE OR REPLACE FUNCTION "enforce_listing_capacity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    property_capacity INTEGER;
BEGIN
    SELECT "total_units" INTO property_capacity
    FROM "properties"
    WHERE "id" = NEW."property_id" AND "landlord_id" = NEW."landlord_id"
    FOR KEY SHARE;

    IF property_capacity IS NULL OR NEW."available_units" > property_capacity THEN
        RAISE EXCEPTION 'listing available units exceed property capacity'
            USING ERRCODE = '23514', CONSTRAINT = 'listings_property_capacity';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "listings_capacity_trigger"
BEFORE INSERT OR UPDATE OF "property_id", "landlord_id", "available_units" ON "listings"
FOR EACH ROW EXECUTE FUNCTION "enforce_listing_capacity"();

CREATE OR REPLACE FUNCTION "enforce_property_capacity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "listings"
        WHERE "property_id" = NEW."id"
          AND "available_units" > NEW."total_units"
          AND "deleted_at" IS NULL
    ) THEN
        RAISE EXCEPTION 'property capacity is below an existing listing allocation'
            USING ERRCODE = '23514', CONSTRAINT = 'properties_listing_capacity';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "properties_capacity_trigger"
BEFORE UPDATE OF "total_units" ON "properties"
FOR EACH ROW EXECUTE FUNCTION "enforce_property_capacity"();

-- Inquiries are accepted only for current public inventory and the composite
-- foreign key guarantees that the recipient owns the listing.
CREATE OR REPLACE FUNCTION "enforce_inquiry_target"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "listings"
        WHERE "id" = NEW."listing_id"
          AND "landlord_id" = NEW."landlord_id"
          AND "status" = 'published'
          AND "available_units" > 0
          AND "deleted_at" IS NULL
    ) THEN
        RAISE EXCEPTION 'inquiry target must be a published available listing'
            USING ERRCODE = '23514', CONSTRAINT = 'inquiries_valid_listing';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "inquiries_valid_listing_trigger"
BEFORE INSERT OR UPDATE OF "listing_id", "landlord_id" ON "inquiries"
FOR EACH ROW EXECUTE FUNCTION "enforce_inquiry_target"();

CREATE OR REPLACE FUNCTION "enforce_report_resolver_role"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."resolved_by_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "users" WHERE "id" = NEW."resolved_by_id" AND "role" = 'admin'
    ) THEN
        RAISE EXCEPTION 'report resolver must be an admin'
            USING ERRCODE = '23514', CONSTRAINT = 'reports_admin_resolver';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "reports_admin_resolver_trigger"
BEFORE INSERT OR UPDATE OF "resolved_by_id" ON "reports"
FOR EACH ROW EXECUTE FUNCTION "enforce_report_resolver_role"();

-- Keep audit timestamps reliable even when a mutation bypasses Prisma.
CREATE OR REPLACE FUNCTION "set_updated_at"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."updated_at" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "users_updated_at_trigger" BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "student_profiles_updated_at_trigger" BEFORE UPDATE ON "student_profiles"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "landlord_profiles_updated_at_trigger" BEFORE UPDATE ON "landlord_profiles"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "landlord_entitlements_updated_at_trigger" BEFORE UPDATE ON "landlord_entitlements"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "institutions_updated_at_trigger" BEFORE UPDATE ON "institutions"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "properties_updated_at_trigger" BEFORE UPDATE ON "properties"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "listings_updated_at_trigger" BEFORE UPDATE ON "listings"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "listing_images_updated_at_trigger" BEFORE UPDATE ON "listing_images"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "inquiries_updated_at_trigger" BEFORE UPDATE ON "inquiries"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "reports_updated_at_trigger" BEFORE UPDATE ON "reports"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
