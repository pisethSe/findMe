# Proposed MVP architecture

Status: domain and database foundation implemented; web provider choices remain
provisional until product setup is confirmed

## Stack

- Web application: Next.js with TypeScript and the App Router.
- Styling: CSS variables and CSS modules or Tailwind, with accessible reusable
  components and no dependency on a large visual kit.
- Database: PostgreSQL with PostGIS for distance and map-bound queries.
- Authentication: phone one-time passwords for owners; email, phone, or a
  supported social option for students after an action requires an account.
- Image storage: S3-compatible object storage with server-side resizing and
  metadata removal.
- Maps: MapLibre GL with an OpenStreetMap-compatible tile/geocoding provider.
- Messaging: phone and Telegram deep links for MVP; platform inbox stores
  inspection requests without attempting to replace familiar communication.
- Deployment: a managed web host, managed PostgreSQL, object storage, and a
  transactional SMS provider selected for Cambodian delivery reliability.

Provider selection should remain replaceable. Map tiles, geocoding, SMS, and
storage require adapters rather than provider-specific calls throughout the
application.

## Application boundaries

```text
Browser
  ├─ public search, map, listing details
  ├─ student shortlist and comparison
  ├─ owner listing manager
  └─ administrator moderation
        │
Next.js application
  ├─ authentication and authorization
  ├─ listing/search service
  ├─ verification and moderation service
  ├─ inquiry/inspection service
  └─ notification jobs
        │
PostgreSQL + PostGIS ── object storage
        │
External adapters: maps/geocoding, SMS, Telegram links
```

## Implemented HTTP surface

- `GET /api/health`: uncached service health and timestamp.
- `GET /api/v1/universities`: bilingual initial university directory.
- `GET /api/v1/listings`: university-first search with maximum rent, distance,
  and room-type filters; returns public coordinates, distance, cost, freshness,
  verification, and explainable organic ranking metadata.

The current routes use clearly labelled demonstration inventory behind the same
domain boundary that a PostgreSQL repository will implement. Pending-review and
expired listings are excluded before ranking, and promotion is metadata rather
than an organic-score multiplier.

## Core data model

### Identity and access

- `users`: id, role, preferred locale, status, timestamps.
- `student_profiles`: user id, optional university id, province of origin.
- `owner_profiles`: user id, display name, phone, identity-review status.
- `admin_audit_events`: actor, action, target, reason, timestamp.

### Discovery

- `universities`: bilingual name, campus name, coordinates, address, active.
- `properties`: owner, bilingual title/description, approximate and exact
  coordinates, address fields, property type, rules, moderation status.
- `units`: property, room type, capacity, gender policy, area, rent, deposit,
  availability, available date.
- `utility_costs`: unit, electricity rate, water charge model, internet,
  parking, other recurring fees.
- `amenities` and `property_amenities`.
- `property_images`: storage key, order, moderation status, dimensions.
- `listing_verifications`: verification type, state, reviewer, evidence metadata,
  checked and expiry timestamps.

### Engagement and safety

- `favorites`: student, property or unit, timestamp.
- `comparison_sets`: student or anonymous session with selected unit ids.
- `inquiries`: student, unit, channel, message, state, timestamps.
- `inspection_requests`: unit, requested times, status, owner response.
- `reports`: reporter, target, category, description, state, resolution.
- `availability_confirmations`: unit, owner, confirmation timestamp.

Store money as integer minor units plus currency, even if the initial UI uses
USD. Store distances as calculated query results rather than permanent truth.

## Search design

PostGIS should support:

- results within a radius of a university;
- results inside the current map bounds;
- distance ordering;
- bounding-box prefilter followed by exact distance checks.

Travel-time estimates should be introduced through a routing adapter. Straight-
line distance may be used for the earliest pilot only when clearly labelled.

Every search result should return the fields needed for a result card in one
query. Do not fetch complete descriptions or all full-resolution images. Serve
one optimized thumbnail per result and paginate with stable cursors.

## Authorization

- Public users can read active, non-expired listings and university data.
- Students can modify only their own saved items, inquiries, inspection requests,
  and reports.
- Owners can modify only their own profiles, properties, and units; they cannot
  set verification or moderation states.
- Administrators use explicit permission scopes and every moderation action is
  audited.
- Exact coordinates and identity evidence are never returned by general public
  APIs.

## Privacy and abuse controls

- Minimize identity documents and define deletion/retention periods before
  collecting them.
- Strip EXIF location metadata from uploaded photos.
- Rate-limit OTP requests, contact reveals, inquiries, and reports.
- Scan uploads and validate MIME type, dimensions, and file size server-side.
- Obscure owner phone numbers from crawlers and require an intentional reveal.
- Log verification state changes and sensitive-data access.
- Provide account deletion and data export workflows.

## Delivery phases

1. Foundation: project setup, bilingual routing, tokens, authentication model,
   database schema, and university seed data.
2. Student discovery: university search, map/list results, filters, listing detail,
   favorites, comparison, and contact actions.
3. Supply: owner onboarding, listing creation, uploads, unit availability, and
   performance summary.
4. Trust operations: moderation queue, verification signals, reporting, expiry,
   and reminder jobs.
5. Pilot hardening: accessibility, performance on low-cost phones and slower
   networks, analytics, backups, abuse testing, and operational runbooks.

## Testing gates

- Unit tests for cost calculation, authorization, ranking, expiry, and state
  transitions.
- Integration tests for spatial queries and role boundaries.
- End-to-end tests for the three critical paths: student shortlist, owner publish,
  administrator approve.
- Accessibility checks plus manual keyboard and screen-reader review.
- Responsive checks at 360 px, 768 px, 1024 px, and wide desktop layouts.
- Performance budget for search on a throttled mobile profile, including image
  weight and map lazy-loading.
