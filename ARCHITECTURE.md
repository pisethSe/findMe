# Student Rental SaaS — System Architecture

**Architecture status:** MVP baseline

**Primary deployment model:** Containerized web + API with managed PostgreSQL and Redis

**Core stack:** Next.js, NestJS, Neon PostgreSQL, Redis, Docker, Google Maps Platform

---

## 1. Architecture Goals

The architecture must support a student-first rental marketplace that is:

- fast on mobile;
- easy to develop and deploy;
- safe for user-generated listings;
- optimized for geographic search around schools/universities;
- able to scale without turning the MVP into unnecessary microservices;
- resilient when external services such as Google Maps are slow or unavailable;
- explicit about authorization, moderation, privacy, and data ownership.

The MVP should use a **modular monolith**, not microservices. Next.js is the web application, NestJS is the authoritative application/API backend, Neon PostgreSQL is the source of truth, Redis supports cache/rate limits/ephemeral state, and Google Maps supplies map/location services.

---

## 2. High-Level Architecture

```text
┌───────────────────────────────────────────────────────────────┐
│                         User Browser                          │
│  Student UI        Landlord UI          Admin UI              │
└──────────────────────────────┬────────────────────────────────┘
                               │ HTTPS
                               v
┌───────────────────────────────────────────────────────────────┐
│                    Next.js Web Application                    │
│ App Router • SSR/RSC where useful • Client map components    │
│ Search UI • Listing pages • Dashboards • Auth presentation    │
└──────────────────────────────┬────────────────────────────────┘
                               │ HTTPS / JSON REST
                               v
┌───────────────────────────────────────────────────────────────┐
│                        NestJS API                              │
│ Auth • Users • Institutions • Listings • Search • Favorites   │
│ Inquiries • Reports • Admin • Media metadata • Audit          │
└───────────────┬──────────────────────┬────────────────────────┘
                │                      │
                │ SQL                  │ cache/rate limits/jobs
                v                      v
┌──────────────────────────┐   ┌───────────────────────────────┐
│ Neon PostgreSQL          │   │ Redis                         │
│ + PostGIS                │   │ cache • rate limit • ephemeral│
│ source of truth          │   │ locks / queues if introduced  │
└──────────────────────────┘   └───────────────────────────────┘
                │
                │ listing media metadata
                v
┌──────────────────────────┐
│ Object Storage           │
│ S3-compatible/R2/etc.    │
│ rental photos            │
└──────────────────────────┘

External integrations:
- Google Maps JavaScript API
- Google Places API / Place Autocomplete
- Google Geocoding API when server-side geocoding is needed
- Google Routes API (P1, optional travel-time feature)
```

---

## 3. Tech Stack Decisions

### 3.1 Frontend — Next.js

Use **Next.js with App Router and TypeScript**.

Responsibilities:

- public landing page;
- search/list/map experience;
- listing details;
- student account pages;
- landlord dashboard;
- admin dashboard;
- SEO metadata for public listings;
- server rendering where it improves first load/SEO;
- client components only where browser APIs/interactivity are required, especially Google Maps.

Recommended frontend libraries:

- TypeScript;
- Tailwind CSS for utility styling;
- shadcn/ui may be used as a source of accessible primitives, but components must be deliberately restyled and composed rather than shipped in untouched default form;
- React Hook Form;
- Zod for frontend form schemas where useful;
- TanStack Query for authenticated/client-side server state and map-search interactions;
- `next-intl` or equivalent for Khmer/English localization readiness.

Do not turn Next.js into a second business-logic backend. Important authorization, listing rules, moderation rules, search rules, and writes belong to NestJS.

### 3.2 Backend — NestJS

Use **NestJS with TypeScript** as the authoritative API and business layer.

Recommended API style for MVP: **REST JSON**, versioned under `/api/v1`.

NestJS modules:

```text
AppModule
├── AuthModule
├── UsersModule
├── StudentProfilesModule
├── LandlordProfilesModule
├── OnboardingModule
├── EntitlementsModule
├── InstitutionsModule
├── ListingsModule
├── AmenitiesModule
├── SearchModule
├── FavoritesModule
├── InquiriesModule
├── ReportsModule
├── MediaModule
├── AdminModule
├── AuditModule
├── CacheModule
└── HealthModule
```

Cross-cutting backend concerns:

- global validation pipe;
- structured exception mapping;
- authentication guards;
- role/ownership guards;
- request IDs;
- structured logs;
- rate limiting;
- OpenAPI/Swagger specification;
- database transactions for multi-record changes;
- audit records for important admin actions.

### 3.3 Database — Neon PostgreSQL + PostGIS

Use **Neon PostgreSQL** as the system of record.

Enable the **PostGIS** extension and store searchable property/institution locations as `geography(Point, 4326)` or a compatible PostGIS point representation in addition to explicit latitude/longitude fields when practical.

Why PostGIS:

- radius search around an institution;
- map viewport/bounding-box search;
- distance ordering;
- geographic indexes;
- avoids downloading all properties to calculate distance in JavaScript.

Example migration prerequisite:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Use a pooled Neon database connection for the long-running/containerized NestJS application and keep connection counts bounded.

### 3.4 ORM — Prisma

Recommended MVP ORM: **Prisma**.

Responsibilities:

- schema definition for ordinary relational entities;
- migrations;
- typed database access;
- transactions.

For advanced PostGIS expressions that are awkward through the ORM, use reviewed parameterized SQL through Prisma’s safe raw-query facilities. Keep geographic SQL in a dedicated repository/service rather than scattering raw SQL through controllers.

Alternative: Drizzle ORM is acceptable if the implementation team prefers stronger SQL control. Choose one ORM and do not mix multiple ORMs.

### 3.5 Redis

Use Redis for data that is **ephemeral or safely reproducible**, not as the source of truth.

Initial Redis use cases:

- API rate-limiting counters;
- cache for high-read, low-volatility data such as institution/amenity lists;
- short-lived search cache when measurements prove it helps;
- short-lived auth/session support if required by the final auth design;
- idempotency/short locks for selected write operations if required later.

Potential later use:

- background job queue;
- email/notification jobs;
- media processing jobs;
- stale-listing reminder jobs.

Do not cache sensitive personalized responses globally.

### 3.6 Docker

Use Docker for local consistency and production container builds.

Recommended local services:

```text
web      -> Next.js
api      -> NestJS
redis    -> Redis
```

Neon remains a managed external database rather than running a local Neon instance. For offline/local database development, a normal PostgreSQL + PostGIS Docker container may be used with the same migrations.

Use multi-stage Dockerfiles and non-root runtime users.

### 3.7 Media storage

Do **not** store listing image binary data directly in PostgreSQL.

Use an S3-compatible object store such as Cloudflare R2, AWS S3, or another approved provider. PostgreSQL stores object keys, URLs/variants, metadata, order, and ownership.

Upload design:

1. authenticated landlord requests an upload authorization;
2. backend validates intended file metadata;
3. client uploads directly using a short-lived signed URL when supported;
4. client/backend finalizes media record;
5. only finalized media can be attached to a published listing.

### 3.8 Google Maps Platform

Use Google Maps as a location presentation/enrichment service, not as the source of truth for rentals.

Recommended APIs:

- **Maps JavaScript API:** interactive student search map and landlord location picker;
- **Maps JavaScript 3D library:** `Map3DElement` for capable-device landing/search scenes and `Marker3DInteractiveElement`/supported marker primitives for rental selection;
- **Places API / Place Autocomplete:** institution/address/location search;
- **Geocoding API:** translate addresses/place IDs into coordinates when server-side geocoding is necessary;
- **Routes API:** optional P1 travel distance/time estimates.

Store:

- `latitude`;
- `longitude`;
- PostGIS point;
- normalized/display address;
- Google Place ID when applicable.

API keys:

- separate browser and server keys;
- browser key restricted by allowed origins/referrers and specific APIs;
- server key kept secret and restricted appropriately;
- never commit a key to the repository.

3D map policy:

- treat 3D as progressive enhancement, not a correctness dependency;
- load the browser Maps library only inside a dedicated client boundary;
- use a stable 2D map/listing-card fallback when 3D is unsupported, hardware acceleration is unavailable, reduced motion is requested, the network is constrained, quota fails, or map initialization errors;
- keep camera motion slow, finite, interruptible, and disabled under `prefers-reduced-motion`;
- use marker label/icon/shape together with green for available and red for unavailable;
- the public search default remains published and available inventory. The landing hero may show labelled unavailable demo markers to explain status, but it must not imply that unavailable inventory can be rented;
- enforce a marker budget and cluster/simplify before rendering dense scenes.

Official implementation references:

- 3D map element: https://developers.google.com/maps/documentation/javascript/reference/3d-map
- 3D markers: https://developers.google.com/maps/documentation/javascript/3d/marker-overview
- 3D support/known issues: https://developers.google.com/maps/documentation/javascript/3d/support

---

## 4. Repository Structure

Repository layout for this project:

```text
student-rental/
├── frontend-part/                 # Next.js App Router web application
│   ├── src/app/
│   ├── src/components/
│   ├── src/features/
│   ├── src/lib/
│   └── tests/
├── backend-part/                  # authoritative modular NestJS API
│   ├── src/modules/
│   ├── src/common/
│   ├── src/config/
│   └── tests/
├── shared-part/
│   └── contracts/                 # safe shared REST contracts
├── database-part/                 # Prisma, migrations, and seed data
├── deploy-part/                   # Docker and environment deployment assets
├── admin-part/                    # admin boundary/runbook, not a third service
├── pnpm-workspace.yaml
├── PRD.md
├── ARCHITECTURE.md
├── ARCHITECTURE-ESSENTIALS.md
└── AGENTS.md
```

Admin UI code remains in the Next.js application and authoritative admin logic
remains in NestJS. `admin-part/` documents that cross-cutting boundary; it does
not create a separate deployable application or duplicate authentication.

Use `pnpm` workspaces. Turborepo is optional; do not add it unless it improves
the actual development workflow.

---

## 5. Domain Model

### 5.1 Domain boundaries

- **Identity:** users, credentials/sessions, roles.
- **Onboarding and access:** one-time role selection and landlord trial/entitlement enforcement.
- **Profiles:** student and landlord-specific profile data.
- **Institutions:** schools, colleges, universities and coordinates.
- **Rental supply:** properties/listings, amenities, images, availability.
- **Discovery:** geographic search, filters, sort/ranking.
- **Engagement:** favorites and inquiries.
- **Trust:** reports, moderation, landlord verification, audit logs.

### 5.2 Property vs listing decision

For MVP, keep a clear distinction:

- **Property** represents the physical place/location owned or managed by a landlord.
- **Listing** represents the offer visible to students.

This allows one property to support multiple rooms/units/listings later without duplicating the physical address and map position.

Example:

```text
Property: "Student Rooms near RUPP, Building A"
  ├─ Listing: "Room 201 — $90/month"
  ├─ Listing: "Room 202 — $90/month"
  └─ Listing: "Larger corner room — $120/month"
```

For the simplest initial UI, a landlord can create one property and one listing together in a single wizard.

---

## 6. Data Models

All IDs should use UUIDs unless there is a demonstrated reason otherwise. Store timestamps in UTC and format for the user’s locale in the frontend.

### 6.1 `users`

| Field               | Type                    | Notes                            |
| ------------------- | ----------------------- | -------------------------------- |
| `id`                | UUID PK                 |                                  |
| `email`             | varchar nullable/unique | based on chosen login options    |
| `phone`             | varchar nullable/unique | normalized format if supported   |
| `password_hash`     | text nullable           | never exposed                    |
| `role`              | enum                    | `STUDENT`, `LANDLORD`, `ADMIN`   |
| `status`            | enum                    | `ACTIVE`, `SUSPENDED`, `DELETED` |
| `email_verified_at` | timestamptz nullable    |                                  |
| `phone_verified_at` | timestamptz nullable    |                                  |
| `created_at`        | timestamptz             |                                  |
| `updated_at`        | timestamptz             |                                  |
| `deleted_at`        | timestamptz nullable    | soft deletion where appropriate  |

Constraints:

- at least one supported login identifier must be present;
- normalized identifiers must be unique;
- role changes require privileged logic.

### 6.2 `student_profiles`

| Field                 | Type             | Notes                     |
| --------------------- | ---------------- | ------------------------- |
| `user_id`             | UUID PK/FK users | 1:1                       |
| `display_name`        | varchar          |                           |
| `institution_id`      | UUID FK nullable | optional default school   |
| `preferred_min_price` | numeric nullable | optional                  |
| `preferred_max_price` | numeric nullable | optional                  |
| `preferred_currency`  | char(3)          | default USD or configured |
| `created_at`          | timestamptz      |                           |
| `updated_at`          | timestamptz      |                           |

Avoid collecting unnecessary personal details such as home-province information unless a later requirement justifies it.

### 6.3 `landlord_profiles`

| Field                 | Type                 | Notes                                           |
| --------------------- | -------------------- | ----------------------------------------------- |
| `user_id`             | UUID PK/FK           |                                                 |
| `display_name`        | varchar              |                                                 |
| `business_name`       | varchar nullable     |                                                 |
| `contact_phone`       | varchar nullable     | protected according to contact policy           |
| `verification_status` | enum                 | `UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED` |
| `verified_at`         | timestamptz nullable |                                                 |
| `created_at`          | timestamptz          |                                                 |
| `updated_at`          | timestamptz          |                                                 |

Verification documents, if added later, require a separate restricted storage/data policy.

### 6.3.1 `landlord_entitlements`

This MVP table models access policy without pretending that a payment system exists. It is the authoritative source for whether a landlord may create or publish supply.

| Field              | Type                 | Notes                                                     |
| ------------------ | -------------------- | --------------------------------------------------------- |
| `landlord_id`      | UUID PK/FK users     | one current entitlement per landlord                      |
| `status`           | enum                 | `TRIALING`, `ACTIVE`, `EXPIRED`, `SUSPENDED`, `CANCELLED` |
| `source`           | enum                 | `TRIAL`, `ADMIN_GRANT`, future `SUBSCRIPTION`             |
| `trial_started_at` | timestamptz nullable | set once when landlord onboarding activates               |
| `trial_ends_at`    | timestamptz nullable | `trial_started_at + 7 days`                               |
| `access_ends_at`   | timestamptz nullable | future/admin entitlement expiry                           |
| `created_at`       | timestamptz          |                                                           |
| `updated_at`       | timestamptz          |                                                           |

Rules:

- the server clock is authoritative;
- a user can receive the automatic trial only once;
- trial creation and landlord-profile activation occur in one transaction;
- expiry preserves properties, drafts, inquiries, and audit history;
- an idempotent scheduled job pauses published trial listings after expiry, while write guards immediately block restricted actions even if the job is delayed;
- admin extensions/grants are audited;
- future billing-provider customer/subscription IDs belong in a separate billing integration table, not in public DTOs.

### 6.4 `institutions`

| Field              | Type                  | Notes                                      |
| ------------------ | --------------------- | ------------------------------------------ |
| `id`               | UUID PK               |                                            |
| `slug`             | varchar unique        | public URL                                 |
| `name_en`          | varchar               |                                            |
| `name_km`          | varchar nullable      |                                            |
| `institution_type` | enum                  | `UNIVERSITY`, `COLLEGE`, `SCHOOL`, `OTHER` |
| `address`          | text                  |                                            |
| `latitude`         | decimal               |                                            |
| `longitude`        | decimal               |                                            |
| `location`         | geography(Point,4326) | PostGIS                                    |
| `google_place_id`  | varchar nullable      |                                            |
| `is_active`        | boolean               |                                            |
| `created_at`       | timestamptz           |                                            |
| `updated_at`       | timestamptz           |                                            |

Indexes:

- unique `slug`;
- GiST index on `location`;
- text/trigram indexes may be added for institution search if needed.

### 6.5 `properties`

| Field             | Type                  | Notes                         |
| ----------------- | --------------------- | ----------------------------- |
| `id`              | UUID PK               |                               |
| `landlord_id`     | UUID FK users         | owner/manager                 |
| `name`            | varchar nullable      | internal/public building name |
| `address_line`    | text                  |                               |
| `district`        | varchar nullable      | Khan                          |
| `commune`         | varchar nullable      | Sangkat                       |
| `city`            | varchar               | MVP default Phnom Penh        |
| `country_code`    | char(2)               | `KH`                          |
| `latitude`        | decimal               |                               |
| `longitude`       | decimal               |                               |
| `location`        | geography(Point,4326) | PostGIS                       |
| `google_place_id` | varchar nullable      |                               |
| `total_units`     | int                   | default `1`, must be positive |
| `created_at`      | timestamptz           |                               |
| `updated_at`      | timestamptz           |                               |
| `deleted_at`      | timestamptz nullable  |                               |

Indexes:

- `landlord_id`;
- GiST `location`;
- common administrative-area fields if filtering uses them.

### 6.6 `listings`

| Field                       | Type                 | Notes                                                                              |
| --------------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| `id`                        | UUID PK              |                                                                                    |
| `property_id`               | UUID FK              |                                                                                    |
| `landlord_id`               | UUID FK users        | duplicated intentionally for ownership querying/integrity checks                   |
| `slug`                      | varchar unique       |                                                                                    |
| `title`                     | varchar              |                                                                                    |
| `description`               | text                 |                                                                                    |
| `property_type`             | enum                 | room/studio/apartment/etc.                                                         |
| `monthly_price`             | numeric(12,2)        | non-negative                                                                       |
| `currency`                  | char(3)              | `USD`, `KHR` initially                                                             |
| `deposit_amount`            | numeric nullable     |                                                                                    |
| `deposit_notes`             | text nullable        |                                                                                    |
| `utility_notes`             | text nullable        |                                                                                    |
| `bedrooms`                  | smallint nullable    |                                                                                    |
| `bathrooms`                 | smallint nullable    |                                                                                    |
| `furnished`                 | boolean nullable     |                                                                                    |
| `available_from`            | date nullable        |                                                                                    |
| `available_units`           | int                  | current rentable count; `0 <= available_units <= property.total_units`             |
| `availability_confirmed_at` | timestamptz nullable | stale-listing signal                                                               |
| `contact_preference`        | enum                 | in-app only, phone, Telegram, or phone/Telegram; profile channel must exist        |
| `status`                    | enum                 | `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `PAUSED`, `RENTED`, `REJECTED`, `ARCHIVED` |
| `moderation_note`           | text nullable        | never public by default                                                            |
| `published_at`              | timestamptz nullable |                                                                                    |
| `created_at`                | timestamptz          |                                                                                    |
| `updated_at`                | timestamptz          |                                                                                    |
| `deleted_at`                | timestamptz nullable |                                                                                    |

Indexes:

- `(status, published_at DESC)`;
- `(landlord_id, status)`;
- `property_id`;
- `monthly_price`;
- `property_type`;
- `availability_confirmed_at`.

Search joins `listings -> properties` for geographic filtering.

### 6.7 `listing_images`

| Field         | Type             | Notes                                     |
| ------------- | ---------------- | ----------------------------------------- |
| `id`          | UUID PK          |                                           |
| `listing_id`  | UUID FK          |                                           |
| `storage_key` | text             | canonical object key                      |
| `public_url`  | text nullable    | if delivery model uses stable CDN URLs    |
| `alt_text`    | varchar nullable |                                           |
| `width`       | int nullable     |                                           |
| `height`      | int nullable     |                                           |
| `sort_order`  | int              |                                           |
| `status`      | enum             | `UPLOADING`, `READY`, `FAILED`, `REMOVED` |
| `created_at`  | timestamptz      |                                           |

Constraint: unique `(listing_id, sort_order)` where practical.

### 6.8 `amenities`

| Field        | Type             | Notes                     |
| ------------ | ---------------- | ------------------------- |
| `id`         | UUID PK          |                           |
| `key`        | varchar unique   | stable machine identifier |
| `name_en`    | varchar          |                           |
| `name_km`    | varchar nullable |                           |
| `category`   | varchar nullable |                           |
| `is_active`  | boolean          |                           |
| `sort_order` | int              |                           |

### 6.9 `listing_amenities`

| Field        | Type    | Notes        |
| ------------ | ------- | ------------ |
| `listing_id` | UUID FK | composite PK |
| `amenity_id` | UUID FK | composite PK |

### 6.10 `favorites`

| Field        | Type          | Notes        |
| ------------ | ------------- | ------------ |
| `student_id` | UUID FK users | composite PK |
| `listing_id` | UUID FK       | composite PK |
| `created_at` | timestamptz   |              |

Unique `(student_id, listing_id)` makes favorite creation idempotent.

### 6.11 `inquiries`

| Field         | Type          | Notes                                |
| ------------- | ------------- | ------------------------------------ |
| `id`          | UUID PK       |                                      |
| `listing_id`  | UUID FK       |                                      |
| `student_id`  | UUID FK users |                                      |
| `landlord_id` | UUID FK users |                                      |
| `message`     | text          | limited length                       |
| `status`      | enum          | `NEW`, `READ`, `RESPONDED`, `CLOSED` |
| `created_at`  | timestamptz   |                                      |
| `updated_at`  | timestamptz   |                                      |

Indexes:

- `(landlord_id, created_at DESC)`;
- `(student_id, created_at DESC)`;
- `(listing_id, created_at DESC)`.

### 6.12 `reports`

| Field             | Type                   | Notes                                                                     |
| ----------------- | ---------------------- | ------------------------------------------------------------------------- |
| `id`              | UUID PK                |                                                                           |
| `reporter_id`     | UUID FK nullable       | according to reporting policy                                             |
| `listing_id`      | UUID FK nullable       | MVP report target                                                         |
| `reason`          | enum                   | inaccurate, unavailable, scam/suspicious, duplicate, inappropriate, other |
| `details`         | text nullable          |                                                                           |
| `status`          | enum                   | `OPEN`, `IN_REVIEW`, `RESOLVED`, `DISMISSED`                              |
| `resolved_by`     | UUID FK admin nullable |                                                                           |
| `resolution_note` | text nullable          | restricted                                                                |
| `created_at`      | timestamptz            |                                                                           |
| `resolved_at`     | timestamptz nullable   |                                                                           |

### 6.13 `audit_logs`

| Field           | Type             | Notes                       |
| --------------- | ---------------- | --------------------------- |
| `id`            | UUID PK          |                             |
| `actor_user_id` | UUID FK nullable |                             |
| `action`        | varchar          | e.g. `LISTING_APPROVED`     |
| `entity_type`   | varchar          |                             |
| `entity_id`     | UUID/text        |                             |
| `metadata`      | jsonb            | exclude secrets             |
| `ip_hash`       | varchar nullable | only if policy justifies it |
| `created_at`    | timestamptz      |                             |

Audit logs should be append-oriented.

### 6.14 `refresh_sessions` (if refresh-token auth is selected)

| Field        | Type                 | Notes                         |
| ------------ | -------------------- | ----------------------------- |
| `id`         | UUID PK              |                               |
| `user_id`    | UUID FK              |                               |
| `token_hash` | text                 | never store raw refresh token |
| `expires_at` | timestamptz          |                               |
| `revoked_at` | timestamptz nullable |                               |
| `created_at` | timestamptz          |                               |

---

## 7. Relationship Overview

```text
User (STUDENT) ─────── 1:1 StudentProfile
       │
       ├────────────── * Favorites * ───── Listing
       │
       └────────────── * Inquiry * ─────── Listing

User (LANDLORD) ────── 1:1 LandlordProfile
       │
       ├────────────── 1:1 LandlordEntitlement
       │
       ├────────────── 1:* Property
       │                         │
       │                         └──── 1:* Listing
       │                                      │
       │                                      ├── 1:* ListingImage
       │                                      └── *:* Amenity
       │
       └────────────── 1:* Inquiry (recipient)

Institution owns a geographic point used as the center of student searches.

Listing/Property can receive Reports.
Admin actions create AuditLogs.
```

---

## 8. Geographic Search Design

### 8.1 Search by institution radius

Inputs:

- `institutionId`;
- `radiusMeters`;
- optional `minPrice` / `maxPrice`;
- `propertyTypes[]`;
- `amenityIds[]`;
- availability;
- sort;
- cursor/page.

Conceptual SQL:

```sql
SELECT
  l.*,
  ST_Distance(p.location, i.location) AS distance_meters
FROM listings l
JOIN properties p ON p.id = l.property_id
JOIN institutions i ON i.id = $1
WHERE l.status = 'PUBLISHED'
  AND ST_DWithin(p.location, i.location, $2)
ORDER BY distance_meters ASC
LIMIT $3;
```

Use parameterized queries. Add additional filters in SQL.

### 8.2 Search by map viewport

Client sends map bounds:

```json
{
  "north": 11.6,
  "south": 11.5,
  "east": 104.96,
  "west": 104.84
}
```

Backend converts the bounds into a PostGIS envelope and returns only published listings inside the visible region plus filters.

Debounce map movement on the client and cancel superseded requests.

### 8.3 Distance vs travel time

- **P0:** straight-line/geodesic distance calculated in PostgreSQL.
- **P1:** travel distance/time through Google Routes for a small number of displayed/listing-detail candidates.

Do not call a paid route API for every listing in a large search result. Narrow candidates first with PostgreSQL.

---

## 9. API Design

Base path:

```text
/api/v1
```

### 9.1 Auth

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /auth/me
```

### 9.1.1 Onboarding and landlord access

```text
GET    /me/onboarding
POST   /me/onboarding/role        # accepts STUDENT or LANDLORD only
POST   /landlord/onboarding       # completes profile and atomically starts the trial
GET    /landlord/entitlement
POST   /admin/landlords/:id/entitlement-grant
```

The role action is idempotent for the same completed choice and rejects attempts to self-assign `ADMIN` or silently switch an established role. Trial timestamps and allowed landlord capabilities are returned as server-derived DTO fields and are never accepted from the client.

### 9.2 Institutions

```text
GET    /institutions?query=...
GET    /institutions/:id
POST   /admin/institutions
PATCH  /admin/institutions/:id
```

### 9.3 Search/listings

```text
GET    /listings/search
GET    /listings/:slug
POST   /landlord/listings
GET    /landlord/listings
GET    /landlord/listings/:id
PATCH  /landlord/listings/:id
PATCH  /landlord/listings/:id/availability
POST   /landlord/listings/:id/submit
POST   /landlord/listings/:id/pause
POST   /landlord/listings/:id/mark-rented
DELETE /landlord/listings/:id          # domain archive; does not erase history
```

All landlord listing routes derive ownership from the authenticated principal.
Creation atomically writes one `Property` and its initial `Listing`. Metadata
updates are allowed only in editable non-review states; status changes use the
named commands above. Active entitlement is required for creation, submission,
and availability increases, while availability decreases and owned reads remain
available after expiry.

Suggested search query example:

```text
GET /api/v1/listings/search?institutionId=...&radiusMeters=3000&maxPrice=150&currency=USD&propertyType=ROOM&amenities=wifi,ac&sort=distance
```

### 9.4 Favorites

```text
GET    /me/favorites
PUT    /me/favorites/:listingId
DELETE /me/favorites/:listingId
```

### 9.5 Inquiries

```text
POST   /listings/:listingId/inquiries
GET    /me/inquiries
GET    /landlord/inquiries
PATCH  /landlord/inquiries/:id/status
```

### 9.6 Reports/admin

```text
POST   /listings/:listingId/reports
GET    /admin/reports
PATCH  /admin/reports/:id
GET    /admin/listings/pending
POST   /admin/listings/:id/approve
POST   /admin/listings/:id/reject
POST   /admin/users/:id/suspend
POST   /admin/users/:id/reactivate
```

### 9.7 Media

```text
POST   /media/upload-intents
POST   /media/:id/finalize
DELETE /media/:id
```

---

## 10. API Response Conventions

Success example:

```json
{
  "data": {
    "id": "..."
  }
}
```

Paginated example:

```json
{
  "data": [],
  "meta": {
    "nextCursor": "...",
    "hasMore": true
  }
}
```

Error example:

```json
{
  "error": {
    "code": "LISTING_NOT_FOUND",
    "message": "The rental listing could not be found.",
    "requestId": "...",
    "fields": null
  }
}
```

Do not return stack traces in production.

---

## 11. Authentication and Authorization

Recommended MVP approach:

- access JWT: short lifetime;
- refresh token/session: longer lifetime and revocable;
- refresh token delivered in an `HttpOnly`, `Secure`, appropriately scoped cookie;
- store only a hash of server-managed refresh tokens if persistent refresh sessions are used;
- frontend keeps access token in memory or uses a carefully designed cookie/session strategy;
- rotate refresh tokens if implemented;
- revoke sessions on password reset and account suspension.

Authorization checks:

1. Is the request authenticated?
2. Does the user have the required role?
3. For owned resources, does `resource.landlord_id === currentUser.id`?
4. Is the current resource state valid for the requested transition?

Never rely on a hidden button as authorization.

Role onboarding rules:

- an authenticated account without a completed product role may select `STUDENT` or `LANDLORD` once;
- `ADMIN` is assigned only through a privileged administrative process;
- role onboarding, landlord profile creation, and trial activation use backend domain commands, not direct generic user updates;
- landlord listing creation, submission, publication, re-publication, and increases in available inventory require a valid entitlement guard;
- entitlement checks are performed inside the relevant application/domain service as well as at the route boundary when useful, so alternate callers cannot bypass them.

---

## 12. Listing State Machine

```text
DRAFT
  │ submit
  v
PENDING_REVIEW
  ├── approve ─────> PUBLISHED
  └── reject ──────> REJECTED

PUBLISHED
  ├── landlord pause ─> PAUSED
  ├── mark rented ────> RENTED
  ├── admin remove ───> PAUSED/ARCHIVED according to policy
  └── edit requiring review -> PENDING_REVIEW (for sensitive changes)

PAUSED
  ├── republish/submit -> PENDING_REVIEW or PUBLISHED based on policy
  └── archive -> ARCHIVED

RENTED
  └── relist -> PENDING_REVIEW/PUBLISHED after availability confirmation
```

Implement transitions as domain/service methods, not arbitrary status strings from clients.

---

## 13. Caching Strategy

### Cache candidates

- active institution list/search suggestions: 5–30 minutes;
- amenity catalog: 30–60 minutes;
- public listing details: short TTL only when invalidation is reliable;
- selected popular search results: only after measuring need.

### Invalidation

When a listing changes status, price, location, or important filters:

- invalidate listing detail cache;
- invalidate relevant landlord cache;
- use versioned search cache keys or short TTL rather than trying to enumerate every geographic search key.

### Never cache globally

- `/auth/me`;
- student favorites;
- inquiry lists;
- admin pages;
- private landlord information.

---

## 14. Rate Limiting

Use Redis-backed rate limits at the NestJS layer.

Different policies should exist for:

- login/password reset;
- registration;
- inquiry submission;
- report submission;
- search endpoints;
- media upload-intent requests;
- admin sensitive actions.

Do not use a single global number for every endpoint.

---

## 15. Data Integrity Rules

Examples:

- monthly price must be non-negative;
- currency must be supported;
- latitude/longitude must be valid;
- published listings must have at least one ready photo if product policy requires it;
- published listings must have valid property coordinates;
- favorites must be unique per student/listing;
- listing landlord must match property ownership/management rules;
- inquiries can only target a published listing;
- student cannot create landlord-only resources;
- suspended accounts cannot create/modify active marketplace content;
- soft-deleted properties/listings are excluded from public queries.

Use database constraints in addition to application checks wherever feasible.

---

## 16. Security Architecture

### 16.1 Input and output

- Validate all request DTOs in NestJS.
- Reject unknown or malformed values where appropriate.
- Parameterize all SQL.
- Escape/render user content safely in Next.js.
- Avoid rendering arbitrary HTML from landlord descriptions.

### 16.2 Password/session security

- Argon2id recommended for password hashing.
- Never log passwords, access tokens, refresh tokens, password reset tokens, or API secrets.
- Expire/reset credentials securely.
- Admin sessions may use stricter controls/MFA later.

### 16.3 Google Maps keys

- Client key is expected to be visible to browsers, so protect it with strict origin/referrer and API restrictions.
- Server key remains secret.
- Set quotas/budget alerts.

### 16.4 Upload security

- allow-list image MIME types/extensions;
- size and count limits;
- random/non-user-controlled object keys;
- do not trust client-reported MIME alone;
- future malware/image scanning can be added to the finalize pipeline;
- strip or avoid exposing unnecessary image metadata where possible.

### 16.5 Admin security

- all admin routes require server-side `ADMIN` role checks;
- sensitive actions create audit logs;
- high-risk bulk operations need explicit confirmation and should be idempotent where possible.

---

## 17. Privacy Architecture

- Current browser location is permission-based and should normally be used transiently for search.
- Do not create a location-history table for students in the MVP.
- Student favorites and inquiries are private.
- Landlord contact information is exposed only according to a deliberate contact policy.
- Store only data needed for marketplace operation.
- Logs must avoid full secrets and should minimize personal data.

---

## 18. Frontend Architecture

Suggested feature organization:

```text
src/
├── app/
├── components/
│   ├── ui/
│   └── layout/
├── features/
│   ├── auth/
│   ├── onboarding/
│   ├── landing/
│   ├── institutions/
│   ├── rental-search/
│   ├── rental-detail/
│   ├── favorites/
│   ├── landlord-listings/
│   ├── landlord-entitlement/
│   ├── inquiries/
│   └── admin/
├── lib/
│   ├── api/
│   ├── auth/
│   ├── maps/
│   ├── env/
│   └── i18n/
└── styles/
```

Rules:

- Keep route files thin.
- Keep reusable business UI inside feature folders.
- Keep Google Maps code behind map-specific components/hooks.
- Server components must not import browser-only Maps libraries.
- Keep API calls in a typed API client layer.
- Distinguish server state from local UI state.
- Search filter state should be URL-driven where practical.

### 18.1 Landing and onboarding composition

Desktop landing composition is an asymmetric two-column hero:

- left: exact Khmer headline `ស្វែងរកបន្ទប់ជួលដែលអ្នកពេញចិត្ត​ និងនៅជិតអ្នកបំផុត.` rendered with **Kantumruy Pro**, a concise vertical phrase loop, and clear search/register actions;
- right: a bounded 3D Phnom Penh rental-map preview with labelled availability markers and restrained camera motion;
- mobile: stacked content with the headline and search action first, followed by a lighter map preview or static/list alternative.

The phrase loop keeps fixed dimensions, changes at a calm interval, uses a static accessible text equivalent with no repetitive live-region announcements, pauses where WCAG timing requires it, and shows one phrase when reduced motion is requested. Primary content is visible before JavaScript hydration.

After authentication, the server-provided onboarding state determines routing:

```text
no role -> /onboarding/role
STUDENT -> /search (or saved institution)
LANDLORD, incomplete profile -> /onboarding/landlord
LANDLORD, profile just completed -> /landlord/listings/new
LANDLORD, returning with complete profile -> /landlord
ADMIN -> /admin
```

The role-selection page is Khmer-first and asks `តើអ្នកជាសិស្ស/និស្សិត ឬជាម្ចាស់ផ្ទះជួល?`. Its primary choices are `សិស្ស/និស្សិត` and `ម្ចាស់ផ្ទះជួល`; concise English text may support the Khmer labels.

Completing the landlord profile activates the one-time trial and returns a one-use success destination for the guided first-rental flow. Ordinary onboarding-state reads continue to return `/landlord` for a completed landlord, so abandoning the first-rental form does not trap a returning user in onboarding. The destination is presentation guidance only; every listing write still enforces the landlord role, ownership, valid state, and entitlement on the backend.

The client may optimistically navigate only after the server accepts the role command. It must never infer authority from a query string, local storage, or a hidden control.

### 18.2 Guided first-rental and dashboard composition

The first-rental wizard creates one `Property` and its initial `Listing` without hiding the domain separation. It collects rental/property name, rental type, location/map pin, total and available units, monthly price/currency, deposit, amenities, description, house rules, contact preference, and ordered photos. Location and availability edits update a private marker preview immediately; no draft or pending data enters public search.

The landlord dashboard is a task surface, not an analytics-heavy SaaS template. Its initial hierarchy is:

1. trial/access state and exact end date;
2. primary “Add rental” action;
3. owned rentals with publication state and available/total units;
4. quick availability controls;
5. recent inquiries;
6. basic views/inquiry counts only when real metrics exist.

The dashboard defines loading, empty, API-error, expired-access, and mobile states. An expired landlord keeps read access to existing rentals and inquiries; restricted actions display the server-derived reason and next supported action.

---

## 19. Search UI Data Flow

```text
Student selects institution/filter
          │
          v
URL search params updated
          │
          v
Search query sent to NestJS
          │
          v
NestJS validates query
          │
          v
PostgreSQL/PostGIS filters + sorts
          │
          v
Results DTO returned
          │
          ├──> Listing cards
          └──> Map markers

Map moved by student
          │ debounce
          v
viewport bounds query
          │
          v
same NestJS search service
```

The map and cards must use the same result IDs so selection stays synchronized.

### 19.1 Published listing freshness

“Real time on the map” means two separate behaviors:

- **editing preview:** the landlord sees local form changes reflected immediately in a private map preview;
- **public discovery:** after moderation/publication commits, the API invalidates the listing detail and relevant public-search cache generation. Visible search pages refetch while the tab is active at a bounded interval of no more than 60 seconds, as well as after institution, filter, or viewport changes.

MVP does not need WebSockets or continuous location tracking. A newly returned marker may use a 150–250 ms selection/appearance transition. With `prefers-reduced-motion`, the marker changes instantly. Cards remain the complete fallback when map loading or refresh fails.

---

## 20. Backend Layering

Inside each NestJS domain module:

```text
Controller
   │ HTTP DTOs
   v
Application/Service
   │ business rules
   v
Repository/Data Access
   │
   ├── Prisma
   └── parameterized PostGIS SQL when needed
```

Controllers should not contain geographic SQL, ownership logic, or status-state machines.

---

## 21. Background Jobs

The MVP can launch without a separate worker process if notifications are simple, but the application must run an idempotent scheduled entitlement-expiry command. That command finds expired trials, records the transition, and pauses affected published listings. Write-time entitlement guards remain the immediate enforcement mechanism, so correctness does not depend on exact scheduler timing.

Scheduled/queue tasks:

- landlord trial expiry and listing pausing (P0, retry-safe);
- email notifications;
- image processing;
- stale-listing reminders;
- periodic search-index/data cleanup;
- analytics rollups.

If jobs are added, Redis-backed BullMQ is a natural NestJS option. Database state remains authoritative; queued jobs must be retry-safe/idempotent.

---

## 22. Observability

Minimum production observability:

- structured JSON logs from API;
- request/correlation ID;
- API latency/error metrics;
- health endpoints;
- uptime checks;
- database connection/error monitoring;
- Redis availability;
- Google Maps API quota/billing alerts;
- frontend error monitoring;
- audit trail for admin actions.

Health endpoints:

```text
GET /health/live
GET /health/ready
```

Readiness may check required dependencies without exposing secret details.

---

## 23. Testing Strategy

### Unit tests

Test business logic such as:

- listing state transitions;
- authorization/ownership checks;
- filter normalization;
- currency/price validation;
- inquiry rules.

### Integration tests

Use a real PostgreSQL/PostGIS test database for:

- geographic radius queries;
- database constraints;
- transactions;
- repository behavior;
- auth persistence.

### API end-to-end tests

Critical flows:

- register/login;
- landlord listing creation;
- forbidden cross-landlord edit;
- admin approval;
- student institution search;
- distance filter;
- favorite/unfavorite;
- inquiry submission;
- reporting/moderation.

### Frontend end-to-end tests

Use Playwright for:

- student search flow;
- map/list synchronization at a basic level;
- listing detail;
- landlord create/edit listing;
- authentication/role redirects;
- mobile viewport checks.

Mock third-party Maps network behavior where appropriate in deterministic CI tests and maintain a smaller integration check for real configured environments.

---

## 24. Deployment Architecture

Logical production topology:

```text
Internet
   │
   ├──> Next.js web container(s)
   │
   └──> NestJS API container(s)
             │
             ├──> Neon PostgreSQL
             ├──> Managed Redis
             ├──> Object storage
             └──> Google APIs
```

Deployment platform can be selected later. The application should not depend on provider-specific runtime behavior unnecessarily.

Use separate environments:

- local;
- staging;
- production.

Never share production credentials with staging/local.

---

## 25. Configuration / Environment Variables

Example names, not actual secrets:

```text
# shared
NODE_ENV=
APP_ENV=

# web
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=

# API
PORT=
DATABASE_URL=
DATABASE_URL_UNPOOLED=
SHADOW_DATABASE_URL=
REDIS_URL=
JWT_ACCESS_SECRET=
JWT_ACCESS_TTL=
REFRESH_TOKEN_SECRET=
GOOGLE_MAPS_SERVER_KEY=

# media
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
CDN_BASE_URL=
```

Validate required environment variables at application startup.

`NEXT_PUBLIC_*` values are embedded by Next.js during `next build`; container
deployments must supply the browser Maps key, map ID, and public API base URL as
build arguments. `GOOGLE_MAPS_SERVER_KEY` is a backend runtime secret. Staging
and production reject missing Maps configuration, while local/test may omit it
to exercise the required 2D/list fallback.

---

## 26. Database Migration and Seed Strategy

- Migrations are committed to Git.
- Production schema changes occur through migrations, not manual GUI edits.
- CI validates migrations.
- Seed script can populate:
  - initial institutions;
  - amenities;
  - development users/listings only outside production.
- Never seed plaintext real user credentials/data.

`DATABASE_URL` is the pooled runtime connection for the long-lived NestJS
process. `DATABASE_URL_UNPOOLED` is a direct connection reserved for migrations
and seeding. Local PostgreSQL may use the same direct URL for both variables.

---

## 27. Scalability Path

Do not introduce microservices early.

Scale in this order:

1. fix inefficient queries/indexes;
2. add/adjust caching where measurement supports it;
3. horizontally scale stateless web/API containers;
4. move expensive asynchronous work to workers;
5. introduce read optimizations/materialized data if proven necessary;
6. split services only when ownership, deployment, or load boundaries clearly justify it.

Geographic search should remain database-side and indexed.

---

## 28. Key Architecture Decisions (ADRs Summary)

### ADR-001 — Modular monolith

**Decision:** Next.js frontend + one modular NestJS API.
**Reason:** Faster MVP development, straightforward transactions and authorization, easier operations.
**Rejected for MVP:** microservices.

### ADR-002 — PostgreSQL is authoritative

**Decision:** Neon PostgreSQL holds all durable marketplace data.
**Reason:** Relational integrity, transactions, geographic support through PostGIS.
**Redis role:** disposable cache/ephemeral data only.

### ADR-003 — PostGIS for proximity search

**Decision:** Use PostGIS geographic points and indexes.
**Reason:** radius, distance, and viewport search belong in the database.

### ADR-004 — Google Maps is a presentation/location provider

**Decision:** Use Maps/Places/Geocoding, optionally Routes.
**Reason:** strong location UX while keeping property truth in our database.

### ADR-005 — Property and listing are separate

**Decision:** Model physical property separately from the public offer.
**Reason:** allows multiple room/unit offers at one location and avoids future migration pain.

### ADR-006 — REST for MVP

**Decision:** Versioned REST API.
**Reason:** clear contracts, simple NestJS tooling, easy debugging.
**Rejected for MVP:** GraphQL unless a concrete need emerges.

### ADR-007 — Direct-to-object-storage image uploads

**Decision:** signed upload flow and image metadata in PostgreSQL.
**Reason:** avoid proxying large image bodies through API containers and avoid database blobs.

### ADR-008 — URL-driven search state

**Decision:** important student filters are represented in URL query parameters.
**Reason:** shareable/back-button-friendly searches and predictable map/list state.

### ADR-009 — 3D maps are progressive enhancement

**Decision:** Use the Maps JavaScript 3D library on capable devices for the landing preview and optionally student discovery, with a synchronized 2D map/list fallback.
**Reason:** the 3D scene supports the desired spatial experience, while hardware, network, accessibility, and provider failures must never block rental discovery.

### ADR-010 — Server-owned role onboarding and landlord entitlement

**Decision:** A user may self-select only `STUDENT` or `LANDLORD`; the backend atomically activates a one-time seven-day landlord trial and enforces it on supply mutations.
**Reason:** role and trial decisions affect authorization and marketplace visibility, so browser state cannot be authoritative. Payment processing remains a separate future integration.

---

## 29. Technical References

Architecture decisions are aligned with current official documentation:

- Next.js App Router documentation: https://nextjs.org/docs/app
- NestJS caching documentation: https://docs.nestjs.com/techniques/caching
- Neon PostgreSQL documentation: https://neon.com/docs
- Google Maps JavaScript API: https://developers.google.com/maps/documentation/javascript
- Google Maps JavaScript 3D Maps: https://developers.google.com/maps/documentation/javascript/3d
- Google Places API: https://developers.google.com/maps/documentation/places/web-service
- Google Geocoding API: https://developers.google.com/maps/documentation/geocoding

Always re-check provider documentation, pricing, quotas, API restrictions, and current package versions immediately before implementation or production rollout.

---

## 30. Architecture Definition of Done

The architecture is considered implemented correctly when:

- Next.js does not bypass NestJS for protected core business writes;
- every protected mutation has authentication + authorization + ownership/state validation;
- PostgreSQL is the durable source of truth;
- PostGIS-backed radius/viewport queries are tested;
- Redis failure cannot silently lose durable marketplace data;
- landlord map locations persist in PostgreSQL and can be queried near institutions;
- Maps keys are separated/restricted for browser/server usage;
- image binaries are outside PostgreSQL;
- listing state transitions are controlled by backend logic;
- self-service role onboarding cannot assign `ADMIN` or overwrite an established role;
- landlord trial activation is one-time, server-timed, durable, and enforced on restricted supply actions;
- trial expiry preserves landlord data while pausing trial listings and denying restricted writes;
- unit availability constraints prevent negative counts or counts above property capacity;
- 3D map failure/reduced-motion modes preserve a usable 2D map and listing-card path;
- student private data is not publicly exposed;
- core flows have automated tests;
- containers start deterministically from documented environment variables;
- staging and production use separate secrets and data stores.
