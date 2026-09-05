# Rental supply API

Phase 1 Step 1 adds the authoritative NestJS foundation for landlord-owned
properties and listings. Phase 1 Step 2 adds the guided first-rental route,
active amenity reads, and ownership-scoped signed photo uploads. Phase 1 Step 3
adds the task-focused dashboard and ownership-scoped recent inquiry feed. Phase
1 Step 4 adds audited Admin publication, public PostGIS search, post-commit
cache versioning, and bounded visible-page refresh. Phase 1 Step 5 adds the
retry-safe entitlement-expiry lifecycle, automatic listing pausing, and the
dedicated landlord access/recovery view.

## Ownership and access

Every route below requires an authenticated `LANDLORD`. The API derives the
landlord ID from the access token; request bodies cannot set it. Owned-resource
lookups return `LISTING_NOT_FOUND` for both missing listings and listings owned
by another landlord, so private resource existence is not leaked.

An active trial or access grant is required to:

- create a listing;
- submit or resubmit a listing;
- increase available inventory;
- create, finalize, or remove listing-photo uploads.

Expired landlords can still read their listings, edit safe draft metadata, and
reduce availability. They cannot create, submit, publish, increase available
rooms, or change listing photos. The backend service enforces this even when
called outside a controller.

## Entitlement expiry lifecycle

The application runs an immediate entitlement sweep at startup and repeats it
every minute. It selects due `TRIALING` or time-bounded `ACTIVE` entitlements
using the existing `(status, access_ends_at)` index. For each landlord, one
database transaction:

1. conditionally changes the still-due entitlement to `EXPIRED`;
2. changes every non-deleted `PUBLISHED` listing for that landlord to `PAUSED`;
3. records one `LANDLORD_ENTITLEMENT_EXPIRED` audit event with the previous
   access state and paused listing IDs.

The conditional transition makes concurrent application replicas and retries
idempotent: only the transaction that changes the entitlement can pause listings
and create the audit event. Public-search generation and listing-detail cache
keys are invalidated after that transaction commits. Entitlement reads and all
restricted supply guards invoke the same atomic command before evaluating
capabilities, so delayed scheduling cannot allow an expired write.

Expiry does not remove properties, listings, photos, inquiries, or prior audit
history. Draft, review, rejected, rented, paused, and archived listings retain
their state; only listings that are publicly `PUBLISHED` are automatically
paused. Pending moderation approval also rechecks active entitlement and cannot
publish after expiry.

## Endpoints

```text
POST   /api/v1/landlord/listings
GET    /api/v1/landlord/listings?page=1&pageSize=20&status=DRAFT
GET    /api/v1/landlord/inquiries?page=1&pageSize=5
GET    /api/v1/landlord/listings/:id
PATCH  /api/v1/landlord/listings/:id
PATCH  /api/v1/landlord/listings/:id/availability
POST   /api/v1/landlord/listings/:id/submit
POST   /api/v1/landlord/listings/:id/pause
POST   /api/v1/landlord/listings/:id/mark-rented
DELETE /api/v1/landlord/listings/:id
GET    /api/v1/institutions
GET    /api/v1/listings/search?institutionId=:id&radiusMeters=5000
GET    /api/v1/admin/listings/pending?page=1&pageSize=20
POST   /api/v1/admin/listings/:id/approve
POST   /api/v1/admin/listings/:id/reject
```

`GET /landlord/listings` uses explicit offset pagination and returns `page`,
`pageSize`, `total`, and `totalPages`. `DELETE` is a domain archive action; it
does not erase rental history.

`GET /landlord/inquiries` uses the same explicit pagination envelope, derives
the landlord from the access token, and returns only inquiries for that
landlord's listings. Its dashboard-safe response includes the student's display
name but omits student identifiers, email, and unrelated private account data.

`GET /api/v1/amenities` returns active amenities in configured display order so
the form never hardcodes database identifiers.

## Guided first-rental flow

Successful first-time Landlord activation returns
`successNextPath: "/landlord/listings/new"`; an idempotent repeat returns
`successNextPath: "/landlord"`. Ordinary onboarding-state reads continue to
route completed Landlords to `/landlord`, so leaving the form does not trap a
returning user in first-use onboarding.

The guided route:

1. verifies the current server-owned onboarding and entitlement state;
2. collects rental identity, type, total/available units, price and currency;
3. captures an address and map pin through Places/Maps when configured, while
   retaining validated manual latitude/longitude inputs as the fallback;
4. renders availability in the private preview with text and an icon as well as
   color;
5. loads active amenities from PostgreSQL and collects description, rules,
   facilities, dates, and contact preference;
6. validates and orders up to 12 JPEG, PNG, or WebP photos of at most 10 MB
   each;
7. atomically creates the Property and first Listing as a private draft, uploads
   selected photos directly to object storage, and optionally invokes the named
   submit command.

A draft can be saved without photos or current availability. Review submission
requires at least one available unit, a description, and one photo in the UI;
the backend remains authoritative for listing state and availability rules.

If a media upload fails after draft creation, the form reports that the draft is
safe and retries only the remaining photos instead of creating a duplicate
Property/Listing.

## Landlord dashboard

`/landlord` verifies server-owned onboarding state, then loads entitlement,
owned listings, and recent inquiries from the NestJS API. The first view shows
the exact access end date, a primary Add rental action, real rental and inquiry
totals, publication state, price and location context, available/total rooms,
availability freshness, state-valid commands, and the five latest inquiries.

The rental list loads six owned listings at a time. Availability updates are
validated in the client for immediate feedback and enforced again by the
backend. Mark-rented and archive actions require inline confirmation. The empty,
loading, initial API error, incremental-load error, success, and archived
read-only states keep stable, usable layouts.

Editable `DRAFT`, `PAUSED`, `RENTED`, and `REJECTED` rentals link to
`/landlord/listings/:id/edit`. The editor reuses the guided form, loads the
owned listing from the API, preserves existing photos, and saves metadata
through the ownership-scoped update endpoint. Optional fields use explicit
`null` values when a landlord clears them; required fields and the at-least-one
title invariant remain enforced by the service. Availability remains locked in
the editor and is changed through the dashboard's dedicated bounded command.

When access is inactive, the dashboard uses the server capability response to
disable Add rental, omit submit/resubmit, and reject availability increases.
Reading rentals and inquiries, keeping or reducing availability, pausing,
marking rented, and archiving remain available according to each listing's
authoritative state.

The dashboard resolves entitlement before loading rentals and inquiries. This
ensures an expiry transition and its automatic pauses are visible in the same
screen load. If a restricted action crosses the expiry boundary while the page
is open, the `LANDLORD_ENTITLEMENT_REQUIRED` response triggers a dashboard
refresh from server state. `/landlord/trial` is a dedicated access page showing
the exact server-owned window, data-retention behavior, allowed read/reduction
actions, and active/expired/suspended/cancelled states. It does not advertise a
checkout because payment processing is outside the current MVP.

The recent-inquiry query is supported by
`inquiries_landlord_created_id_idx` on `(landlord_id, created_at DESC, id DESC)`,
matching both its ownership filter and stable newest-first ordering.

## Moderation, publication, and search freshness

Only an authenticated `ADMIN` can read the pending queue or approve/reject a
submission. Approval rechecks the listing's current state, available units,
description, ready photo, and landlord entitlement on the backend. The status
change and `LISTING_APPROVED` audit record commit in one PostgreSQL transaction.
Rejection requires a 3–2,000 character correction note and atomically records a
`LISTING_REJECTED` audit action. Landlord-supplied roles, owners, statuses, and
moderation fields are never authoritative.

`GET /listings/search` is public but returns only non-deleted `PUBLISHED`
listings with `available_units > 0`. It validates a live institution UUID,
performs radius filtering and distance ordering with `ST_DWithin` and
`ST_Distance`, and can narrow by price/currency, one or more property types, an
AND-set of amenity keys, availability date, and complete map bounds. Viewport
filtering uses `ST_Intersects` against the same indexed geography column. Price
filters and price sorting require an explicit `USD` or `KHR` currency, so unlike
currencies are never compared as if their numeric amounts were equal. Default
search uses the current Phnom Penh date and excludes future availability unless
the student deliberately supplies `availableBy`. The public serializer omits
street address, landlord identifiers/contact data, and moderation notes.
`listings_publication_feed_idx` supports the publication feed while the existing
PostGIS GiST index handles geographic eligibility.

After approval or a public availability/state change commits, the service
increments a Redis search generation and removes potential detail keys. Public
search entries expire after 30 seconds as a fallback if invalidation is missed.
If Redis is absent in local/test or temporarily unavailable, the request reads
PostgreSQL directly and correctness is preserved. Staging and production
require a valid `redis://` or `rediss://` `REDIS_URL`.

The student `/search` map and card list use the same listing IDs. The page
refetches every 45 seconds while the tab is visible and immediately after its
institution/filter inputs change. It aborts superseded requests, retains the
last complete cards after a refresh failure, prioritizes list view on phones,
and keeps the list usable when Google Maps is disabled or fails.

## Creating the initial property and listing

Creation writes a separate `Property` and initial `Listing` in one database
transaction. A minimal request looks like:

```json
{
  "property": {
    "name": "RUPP Student Rooms",
    "addressLine": "Russian Federation Boulevard, Phnom Penh",
    "latitude": 11.569,
    "longitude": 104.8914,
    "totalUnits": 3
  },
  "titleKm": "បន្ទប់ជួលជិតសាកលវិទ្យាល័យ",
  "propertyType": "ROOM",
  "monthlyPrice": 95,
  "currency": "USD",
  "availableUnits": 2,
  "contactPreference": "IN_APP_ONLY"
}
```

The API generates the slug and derives ownership. `availableUnits` must be from
zero through `property.totalUnits`. Amenities must be active UUIDs. A listing
must have at least one Khmer or English title. Coordinates, prices, counts,
dates, field lengths, unknown fields, and enum values are validated.

Contact preferences are `IN_APP_ONLY`, `PHONE`, `TELEGRAM`, or
`PHONE_OR_TELEGRAM`. A phone/Telegram preference is accepted only when the
corresponding landlord-profile channel exists. Public contact exposure remains
a later deliberate serializer policy.

## Landlord lifecycle

```text
DRAFT          -> submit -> PENDING_REVIEW
DRAFT          -> archive -> ARCHIVED
PENDING_REVIEW -> archive -> ARCHIVED
PUBLISHED      -> pause -> PAUSED
PUBLISHED      -> mark rented -> RENTED
PAUSED         -> submit -> PENDING_REVIEW
PAUSED         -> mark rented -> RENTED
PAUSED         -> archive -> ARCHIVED
RENTED         -> submit -> PENDING_REVIEW
RENTED         -> archive -> ARCHIVED
REJECTED       -> submit -> PENDING_REVIEW
REJECTED       -> archive -> ARCHIVED
```

`PUBLISHED` can only be entered by the Admin moderation service. Landlords
cannot submit a zero-availability listing or send arbitrary status values.
Metadata editing is limited to `DRAFT`, `PAUSED`, `RENTED`, and `REJECTED`.
Availability may be confirmed for every non-archived state. Setting a published
listing to zero available rooms moves it to `RENTED`.

## Stable error codes

Important domain errors include:

- `LISTING_NOT_FOUND`;
- `LISTING_STATE_TRANSITION_INVALID`;
- `LISTING_AVAILABILITY_REQUIRED`;
- `AVAILABLE_UNITS_EXCEED_TOTAL`;
- `PROPERTY_CAPACITY_TOO_LOW`;
- `AMENITIES_INVALID`;
- `CONTACT_PREFERENCE_UNAVAILABLE`;
- `LANDLORD_ONBOARDING_REQUIRED`;
- `LANDLORD_ENTITLEMENT_REQUIRED`;
- `PENDING_LISTING_NOT_FOUND` for missing or non-pending moderation targets;
- `LISTING_NOT_READY_FOR_PUBLICATION` when publication requirements fail;
- `LISTING_MODERATION_CONFLICT` for a concurrent moderation state change;
- `SEARCH_CURRENCY_REQUIRED` for currency-ambiguous price comparisons;
- `SEARCH_PRICE_RANGE_INVALID`;
- `INSTITUTION_NOT_FOUND`;
- `LISTING_CHANGED` for a concurrent state change.

Database constraints and triggers remain the second line of defense for user
roles, property/listing ownership, coordinates, prices, and unit capacity.

## Listing photo uploads

```text
POST   /api/v1/media/upload-intents
POST   /api/v1/media/:id/finalize
DELETE /api/v1/media/:id
```

All media routes require an authenticated `LANDLORD`, an active server-evaluated
entitlement, and an owned listing in an editable state. Cross-owner resources
are hidden as not found. The upload-intent response contains a five-minute
signed `PUT` URL and the exact `Content-Type` header the browser must send.
Object keys are server-generated.

Finalize checks stored object length, storage content type, and JPEG/PNG/WebP
magic bytes before marking image metadata `READY`. The binary stays in
S3-compatible object storage; PostgreSQL stores the key, delivery URL, order,
status, and optional alternative text. Configure:

```text
S3_ENDPOINT              optional for AWS S3; required by some compatible stores
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
CDN_BASE_URL
S3_FORCE_PATH_STYLE      true only when the provider requires path-style URLs
```

Staging and production fail startup when the required media values are absent
or partial. `CDN_BASE_URL` is also required at the staging/production frontend
build so `next/image` can create a strict remote path policy and responsive
rental-card variants; redirects from that optimizer are disabled. Local/test
may omit the complete set; the API then returns
`MEDIA_STORAGE_UNAVAILABLE` while draft listing creation remains functional.
The object-storage bucket must allow browser `PUT` requests from the exact web
origins and allow the `Content-Type` request header required by the signed URL.
