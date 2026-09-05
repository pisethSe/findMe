# FindMe

FindMe is a student-first rental marketplace for Cambodia. It helps students who
move to Phnom Penh discover affordable rooms and houses near their university,
understand the real monthly cost, and contact a verified property owner with
more confidence.

The product has completed its MVP foundation, all five Phase 1 rental supply
steps, and the first two Phase 2 student-discovery steps. The governing
documents are:

- [Product requirements](PRD.md)
- [System architecture](ARCHITECTURE.md)
- [Architecture essentials](ARCHITECTURE-ESSENTIALS.md)
- [Engineering and design instructions](AGENTS.md)
- [Market and user research](docs/PRODUCT_RESEARCH.md)
- [Earlier MVP working specification](docs/MVP_SPEC.md)

## Product promise

> Choose your university. Compare suitable rooms nearby. Know the cost before
> you travel.

## Initial scope

The first launch is for students searching in Phnom Penh. It includes student,
property-owner, and administrator workflows. It deliberately excludes online
rent payments, lease signing, roommate matching, and cities outside Phnom Penh
until the core search and trust model has been validated.

## Engineering foundation

The repository currently includes:

- a pnpm workspace with separate Next.js frontend, NestJS backend, shared
  contracts, database, deployment, and administration boundaries;
- a minimal NestJS API with versioned liveness and readiness endpoints;
- a canonical Prisma 7 schema, reviewed PostgreSQL/PostGIS migration, and
  idempotent institution/amenity seed;
- NestJS email/password authentication with Argon2id, short-lived access
  tokens, rotating database-backed refresh sessions, password reset, and
  reusable role guards;
- one-time Student/Landlord role onboarding, atomic profile activation, and a
  server-timed seven-day Landlord entitlement with expiry-aware capabilities;
- authenticated landlord Property/Listing creation and management APIs with
  server-derived ownership, lifecycle commands, availability constraints,
  contact preferences, and trial enforcement;
- a guided, mobile-first first-rental workflow backed by the live NestJS API,
  with private map/availability preview, active amenities, ordered photos, and
  draft or review submission;
- a task-focused landlord dashboard backed by owned listing and inquiry data,
  with exact access timing, publication states, quick availability updates,
  lifecycle actions, and explicit loading, empty, error, expired, and mobile
  states;
- a protected moderation queue with audited approval/rejection, publication
  readiness and entitlement checks, and backend-only status transitions;
- a production PostGIS feed for published, available rentals plus a responsive
  student map/list that refreshes every 45 seconds while visible;
- bilingual active-institution search and canonical URL-persisted selection on
  the landing and student search surfaces;
- a validated public rental-search API with indexed PostGIS radius and viewport
  filtering, availability dates, price/currency, property-type and amenity
  filters, stable sorting, pagination, cache normalization, and safe DTOs;
- Redis generation-based public-search caching with post-commit invalidation
  and a 30-second cache TTL that keeps PostgreSQL authoritative;
- retry-safe landlord entitlement expiry that atomically records the transition,
  pauses published rentals without deleting supply or inquiry data, and runs
  both at write/read enforcement time and on a one-minute application schedule;
- signed S3-compatible listing-photo uploads with ownership checks, size/type
  validation, byte-signature verification, and PostgreSQL media metadata;
- Docker assets for the frontend, backend, local PostgreSQL/PostGIS, and Redis;
- domain rules for transparent multi-currency rental costs, publish readiness,
  availability freshness, listing state transitions, and explainable ranking;
- automated tests proving that stale or unapproved listings are hidden and that
  paid promotion cannot bypass organic eligibility;
- a production-building Next.js public landing and live published-rental search
  surface;
- a progressively enhanced Google Maps 3D landing preview with a stable 2D/list
  fallback, labelled availability states, and reduced-motion handling;
- repository-wide GitHub Actions checks for formatting, linting, types,
  PostGIS migrations and integration tests, production builds, and container
  smoke tests;
- university-first search/filter domain rules with bilingual demonstration data
  and explicit demo disclaimers.

Rental data ownership and the landlord publication flow are documented in
[Rental data sourcing](docs/DATA-SOURCING.md).

Authentication behavior, environment requirements, and the local
password-reset workflow are documented in
[Authentication foundation](docs/AUTHENTICATION.md).

Role selection, profile activation, and Landlord trial behavior are documented
in [Onboarding and landlord access](docs/ONBOARDING.md).

Landlord listing endpoints, validation, ownership, lifecycle, and entitlement
behavior are documented in [Rental supply API](docs/RENTAL-SUPPLY.md).

Institution search, selection, URL behavior, and student-facing states are
documented in [Student discovery](docs/STUDENT-DISCOVERY.md).

Browser/server credential separation, frontend build arguments, and the cloud
restriction checklist are documented in
[Google Maps production setup](docs/GOOGLE-MAPS.md).

The automated checks, local reproduction commands, and branch-protection
requirements are documented in
[Continuous integration](docs/CONTINUOUS-INTEGRATION.md).

The complete folder map and ownership rules are documented in
[Project structure](PROJECT-STRUCTURE.md).

Run the current checks with:

```bash
corepack pnpm install
corepack pnpm run format:check
corepack pnpm run lint
corepack pnpm run db:validate
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run build
```

Database commands and connection-variable guidance are documented in
[Database part](database-part/README.md).

Start both applications in development with `corepack pnpm run dev`. The
frontend runs on port 3000 and the API runs on port 3001. You can also start
either side independently with `dev:frontend` or `dev:backend`.

The NestJS API exposes:

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/auth/me`
- `GET /api/v1/me/onboarding`
- `POST /api/v1/me/onboarding/role`
- `POST /api/v1/landlord/onboarding`
- `GET /api/v1/landlord/entitlement`
- `GET /api/v1/landlord/inquiries`
- `GET /api/v1/amenities`
- `GET /api/v1/institutions?query=:name&limit=20`
- `GET /api/v1/institutions?slug=:slug&limit=1`
- `GET /api/v1/listings/search?institutionId=:id&radiusMeters=5000&sort=distance`
- `POST /api/v1/landlord/listings`
- `GET /api/v1/landlord/listings`
- `GET /api/v1/landlord/listings/:id`
- `PATCH /api/v1/landlord/listings/:id`
- `PATCH /api/v1/landlord/listings/:id/availability`
- `POST /api/v1/landlord/listings/:id/submit`
- `POST /api/v1/landlord/listings/:id/pause`
- `POST /api/v1/landlord/listings/:id/mark-rented`
- `DELETE /api/v1/landlord/listings/:id` (archives)
- `POST /api/v1/media/upload-intents`
- `POST /api/v1/media/:id/finalize`
- `DELETE /api/v1/media/:id`
- `GET /api/v1/admin/listings/pending`
- `POST /api/v1/admin/listings/:id/approve`
- `POST /api/v1/admin/listings/:id/reject`

The frontend retains the earlier temporary demonstration route handlers for
the Phase 0 contract tests, but `/search` now reads the NestJS public discovery
API:

- `GET /api/health`
- `GET /api/v1/universities`
- `GET /api/v1/listings?university=rupp&maxRentUsd=100&maxDistanceKm=2`

Set both `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` and
`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` at frontend build time to enable the landing
page's Google Maps 3D enhancement and Landlord location picker. The browser key
must allow Maps JavaScript API and Places API (New). Without those values, the
landing page uses the accessible 2D/list preview and the rental form retains its
manual coordinate fallback. Staging and production additionally require the
separate server-only `GOOGLE_MAPS_SERVER_KEY` and complete S3-compatible media
configuration. Pass the public `CDN_BASE_URL` to both the backend runtime and
frontend build so Next.js can strictly allow and responsively optimize only
server-issued rental images. Staging and production also require `REDIS_URL`;
local/test may omit it and public search safely queries PostgreSQL without a
cache. The canonical PostGIS data layer and moderated publication feed are now
wired into NestJS.

The legacy Next.js route handlers still return demonstration data for Phase 0
contract coverage; `/search` never reads them. The SQL under
`database-part/legacy-sql` is an earlier model and remains quarantined for
historical reference. New environments must use the Prisma migrations under
`database-part/prisma/migrations`.
