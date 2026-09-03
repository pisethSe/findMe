CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE user_role AS ENUM ('student', 'owner', 'admin');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE review_state AS ENUM ('unreviewed', 'pending', 'approved', 'rejected');
CREATE TYPE listing_status AS ENUM (
  'draft',
  'pending_review',
  'active',
  'paused',
  'rented',
  'rejected',
  'expired'
);
CREATE TYPE room_type AS ENUM ('private_room', 'shared_room', 'studio', 'house');
CREATE TYPE gender_policy AS ENUM ('any', 'women_only', 'men_only');
CREATE TYPE cost_kind AS ENUM (
  'deposit',
  'electricity',
  'water',
  'internet',
  'parking',
  'other'
);
CREATE TYPE billing_model AS ENUM ('included', 'fixed_monthly', 'metered');
CREATE TYPE verification_kind AS ENUM (
  'phone',
  'identity',
  'location',
  'availability'
);
CREATE TYPE inquiry_channel AS ENUM ('platform', 'phone', 'telegram');
CREATE TYPE inquiry_status AS ENUM ('new', 'read', 'replied', 'closed');
CREATE TYPE inspection_status AS ENUM (
  'requested',
  'accepted',
  'declined',
  'cancelled',
  'completed'
);
CREATE TYPE report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  preferred_locale text NOT NULL DEFAULT 'km' CHECK (preferred_locale IN ('km', 'en')),
  status account_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  province_of_origin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE owner_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 2 AND 120),
  phone_e164 text NOT NULL UNIQUE CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at timestamptz,
  identity_review_state review_state NOT NULL DEFAULT 'unreviewed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_km text NOT NULL,
  name_en text NOT NULL,
  campus_name_km text,
  campus_name_en text,
  address_km text,
  address_en text,
  location geography(Point, 4326) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE student_profiles
  ADD COLUMN university_id uuid REFERENCES universities(id) ON DELETE SET NULL;

CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES owner_profiles(user_id) ON DELETE RESTRICT,
  title_km text,
  title_en text,
  description_km text,
  description_en text,
  property_type room_type NOT NULL,
  exact_location geography(Point, 4326) NOT NULL,
  public_location geography(Point, 4326) NOT NULL,
  address_km text,
  address_en text,
  status listing_status NOT NULL DEFAULT 'draft',
  moderation_state review_state NOT NULL DEFAULT 'unreviewed',
  moderation_note text,
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (title_km IS NOT NULL OR title_en IS NOT NULL),
  CHECK (description_km IS NOT NULL OR description_en IS NOT NULL)
);

CREATE TABLE units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  type room_type NOT NULL,
  gender_policy gender_policy NOT NULL DEFAULT 'any',
  capacity smallint NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 20),
  available_count smallint NOT NULL DEFAULT 1 CHECK (available_count >= 0),
  area_square_metres numeric(8, 2) CHECK (area_square_metres > 0),
  furnished boolean NOT NULL DEFAULT false,
  base_rent_minor bigint NOT NULL CHECK (base_rent_minor >= 0),
  rent_currency char(3) NOT NULL CHECK (rent_currency IN ('USD', 'KHR')),
  available_from date,
  last_availability_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE unit_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  kind cost_kind NOT NULL,
  label_km text,
  label_en text,
  model billing_model NOT NULL,
  amount_minor bigint CHECK (amount_minor >= 0),
  currency char(3) CHECK (currency IN ('USD', 'KHR')),
  meter_unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, kind),
  CHECK (
    model = 'included'
    OR (amount_minor IS NOT NULL AND currency IS NOT NULL)
  ),
  CHECK (model <> 'metered' OR meter_unit IS NOT NULL)
);

CREATE TABLE amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_km text NOT NULL,
  name_en text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE property_amenities (
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
  PRIMARY KEY (property_id, amenity_id)
);

CREATE TABLE property_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  alt_km text,
  alt_en text,
  width integer NOT NULL CHECK (width > 0),
  height integer NOT NULL CHECK (height > 0),
  sort_order smallint NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  moderation_state review_state NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, sort_order)
);

CREATE TABLE listing_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  kind verification_kind NOT NULL,
  state review_state NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  evidence_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, kind),
  CHECK (expires_at IS NULL OR checked_at IS NULL OR expires_at > checked_at)
);

CREATE TABLE favorites (
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, unit_id)
);

CREATE TABLE comparison_items (
  comparison_key uuid NOT NULL,
  student_id uuid REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  anonymous_session_id uuid,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comparison_key, unit_id),
  CHECK (
    (student_id IS NOT NULL AND anonymous_session_id IS NULL)
    OR (student_id IS NULL AND anonymous_session_id IS NOT NULL)
  )
);

CREATE TABLE inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES student_profiles(user_id) ON DELETE SET NULL,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  channel inquiry_channel NOT NULL,
  message text CHECK (message IS NULL OR length(message) <= 2000),
  status inquiry_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inspection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  preferred_times jsonb NOT NULL,
  status inspection_status NOT NULL DEFAULT 'requested',
  owner_message text CHECK (owner_message IS NULL OR length(owner_message) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(preferred_times) = 'array')
);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES units(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 4000),
  status report_status NOT NULL DEFAULT 'open',
  resolution_note text,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(property_id, unit_id) = 1)
);

CREATE TABLE admin_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX universities_location_gix ON universities USING gist (location);
CREATE INDEX properties_exact_location_gix ON properties USING gist (exact_location);
CREATE INDEX properties_public_location_gix ON properties USING gist (public_location);
CREATE INDEX properties_searchable_idx
  ON properties (status, moderation_state, published_at DESC);
CREATE INDEX units_searchable_idx
  ON units (base_rent_minor, rent_currency, available_from)
  WHERE available_count > 0;
CREATE INDEX units_property_idx ON units (property_id);
CREATE INDEX inquiries_owner_worklist_idx ON inquiries (unit_id, status, created_at DESC);
CREATE INDEX reports_moderation_worklist_idx ON reports (status, created_at);
CREATE INDEX admin_audit_target_idx ON admin_audit_events (target_type, target_id, created_at DESC);
