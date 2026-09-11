CREATE TYPE "analytics_event_name" AS ENUM (
  'SEARCH_RESPONSE', 'SEARCH_ZERO_RESULTS', 'LISTING_DETAIL_RESPONSE',
  'FAVORITE_SAVED', 'FAVORITE_REMOVED', 'INQUIRY_CREATED', 'REPORT_CREATED',
  'STUDENT_ROLE_SELECTED', 'LANDLORD_ROLE_SELECTED', 'LANDLORD_TRIAL_STARTED',
  'LISTING_CREATED', 'LISTING_SUBMITTED', 'LISTING_PUBLISHED', 'LISTING_REJECTED'
);

-- Anonymous facts are appended in the marketplace transaction. Updating a
-- shared daily counter would introduce cross-user serialization conflicts.
-- No actor/resource/session/network/geographic fields or free-text payloads.
CREATE TABLE "analytics_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "day" DATE NOT NULL DEFAULT ((clock_timestamp() AT TIME ZONE 'UTC')::date),
  "event" "analytics_event_name" NOT NULL,
  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- Supports bounded day-range summaries grouped by event name.
CREATE INDEX "analytics_events_day_event_idx" ON "analytics_events" ("day", "event");
