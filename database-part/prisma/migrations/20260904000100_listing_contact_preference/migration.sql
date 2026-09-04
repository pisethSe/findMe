-- A listing controls how a student may contact its landlord. The profile keeps
-- the actual contact details; public serializers decide whether to expose them.
CREATE TYPE "contact_preference" AS ENUM (
    'in_app_only',
    'phone',
    'telegram',
    'phone_or_telegram'
);

ALTER TABLE "listings"
    ADD COLUMN "contact_preference" "contact_preference" NOT NULL DEFAULT 'in_app_only';
