# Student Rental SaaS — Architecture Essentials

This file contains only the architecture decisions that must remain consistent during implementation. Read `ARCHITECTURE.md` for full rationale and detail.

---

## 1. System Shape

Build a **modular monolith**:

```text
Next.js Web
    │ REST/HTTPS
    v
NestJS API
    ├── Neon PostgreSQL + PostGIS  <-- durable source of truth
    ├── Redis                      <-- cache/rate limit/ephemeral only
    ├── Object Storage             <-- rental images
    └── Google Maps Platform       <-- maps/places/geocoding/routes
```

Do not introduce microservices for the MVP.

---

## 2. Required Stack

- **Frontend:** Next.js App Router + TypeScript
- **Backend:** NestJS + TypeScript + REST `/api/v1`
- **Database:** Neon PostgreSQL
- **Geospatial:** PostGIS
- **ORM:** Prisma; reviewed parameterized SQL for advanced PostGIS queries
- **Cache / rate limit:** Redis
- **Containers:** Docker
- **Maps:** Google Maps JavaScript API + Places; 3D Maps is progressive enhancement; Geocoding when needed; Routes is optional P1
- **Images:** S3-compatible object storage, never database blobs

---

## 3. Core Roles

```text
STUDENT
LANDLORD
ADMIN
```

Every protected backend action must enforce role and, when relevant, resource ownership.

Never rely on frontend visibility/hiding as authorization.

New users may self-select only `STUDENT` or `LANDLORD` during one-time onboarding. `ADMIN` is never a self-service choice. The backend owns role assignment and onboarding completion.

---

## 4. Core Domain Models

```text
User
├── StudentProfile
└── LandlordProfile

Institution
  └── geographic point

Landlord -> Property -> Listing
                         ├── ListingImage
                         └── Amenities

Student -> Favorite -> Listing
Student -> Inquiry  -> Listing -> Landlord
User    -> Report   -> Listing
Admin actions -> AuditLog
Landlord -> LandlordEntitlement (one-time 7-day trial/access state)
```

Keep **Property** separate from **Listing** so a physical property can support multiple room/unit offers later.

Store `total_units` and `available_units` with a database/domain invariant of `0 <= available_units <= total_units`.

Student discovery is free. A landlord receives one server-timed seven-day trial when landlord onboarding activates. Trial expiry preserves data and inquiries, pauses trial listings, and blocks new/create/publish/availability-expanding actions until an admin grant or future paid entitlement is active.

---

## 5. Geographic Search

Store both readable coordinates and an indexed PostGIS point for each property and institution.

Required queries:

1. rentals within a radius of an institution;
2. rentals inside current map bounds;
3. distance sorting.

Use `ST_DWithin`/`ST_Distance` or equivalent indexed PostGIS operations.

Do not fetch all rentals and calculate filtering in the browser.

P0 distance is geodesic distance from PostgreSQL. Google Routes travel time is P1 and only used on narrowed candidate sets.

---

## 6. Listing States

```text
DRAFT
PENDING_REVIEW
PUBLISHED
PAUSED
RENTED
REJECTED
ARCHIVED
```

Only publishable/public states may appear in student search. Status transitions are backend domain actions, not arbitrary client updates.

---

## 7. Search Requirements

At minimum support:

- institution origin;
- map viewport;
- min/max monthly price;
- max distance;
- property type;
- amenities;
- availability;
- sorting by distance, price, newest;
- pagination/cursor.

Important filters belong in the URL so searches can be shared and restored.

---

## 8. Authentication / Security

- Secure password hashing: Argon2id recommended.
- Short-lived access token/session.
- Revocable refresh/session mechanism.
- `HttpOnly` + `Secure` cookies where cookies carry session/refresh secrets.
- DTO validation for every write.
- Parameterized SQL only.
- Redis-backed rate limits for login, inquiry, reports, search, and uploads.
- No secrets committed to Git.
- Browser and server Google Maps API keys are separate and restricted.
- User-generated descriptions render as safe text, not arbitrary HTML.
- Landlord trial timestamps and entitlement state come from the server clock/database, never request payloads or client storage.

---

## 9. Redis Rule

Redis is **never the only copy of durable product data**.

Use it for:

- rate limiting;
- institution/amenity cache;
- short-lived safe caches;
- future queues/locks.

A Redis reset must not delete users, listings, favorites, inquiries, or moderation state.

---

## 10. Image Rule

Listing image binaries go to object storage.

PostgreSQL stores:

- storage key;
- listing relation;
- dimensions/status/order;
- delivery URL/metadata where applicable.

Use validation and short-lived signed uploads where supported.

---

## 11. Privacy Rule

- Student current location is permission-based and transient by default.
- Do not build student location history.
- Favorites and inquiries are private.
- Do not publicly expose unnecessary personal contact information.
- Logs must not contain passwords, raw tokens, or API secrets.

---

## 12. Frontend / Backend Boundary

**Next.js:** presentation, routing, SEO, forms, map UI, dashboard UI.
**NestJS:** authorization, ownership, business rules, moderation, persistence, search rules, state transitions.

Do not duplicate authoritative marketplace logic in the frontend.

Landing/onboarding rules:

- `/` uses the exact Khmer headline `ស្វែងរកបន្ទប់ជួលដែលអ្នកពេញចិត្ត​ និងនៅជិតអ្នកបំផុត.` in Kantumruy Pro;
- desktop hero places copy/actions left and a clean 3D rental-map preview right; mobile stacks content and prioritizes search;
- 3D maps must fall back to a usable 2D map/list when unsupported, slow, failed, or reduced motion is requested;
- green available and red unavailable markers also require a label/icon/shape because color alone is insufficient;
- the vertical phrase loop has fixed layout, a static accessible equivalent, no repetitive live announcements, and a reduced-motion state;
- after authentication, incomplete users go to `/onboarding/role`; completed users route by server-provided role/profile state.

---

## 13. Critical Test Gates

Before a feature is called complete, tests must cover the affected critical behavior.

Mandatory MVP checks include:

- landlord A cannot edit landlord B’s listing;
- unpublished listing is absent from student search;
- institution radius search returns correct distance ordering;
- favorite uniqueness works;
- inquiry requires a valid published listing and appropriate user;
- admin-only routes reject non-admin users;
- listing state transitions reject invalid changes;
- Redis outage does not corrupt durable data;
- map coordinates persist and round-trip correctly.
- self-service onboarding rejects `ADMIN` and cannot overwrite an established role;
- landlord trial starts exactly once and restricted mutations fail after expiry;
- `available_units` cannot be negative or exceed `total_units`;
- map discovery remains usable when the 3D map cannot initialize or reduced motion is enabled.

---

## 14. Deployment Rules

- Dockerized Next.js and NestJS.
- Separate local/staging/production configuration.
- Managed Neon and Redis in deployed environments.
- Multi-stage container builds.
- Non-root runtime user where practical.
- Environment validation on startup.
- Migrations are versioned and committed.
- Production schema changes happen through migrations.

---

## 15. Do Not Do

- Do not start with microservices.
- Do not use Redis as the database.
- Do not store images in PostgreSQL.
- Do not calculate all geographic filtering on the client.
- Do not trust client-provided roles, owner IDs, prices, status transitions, or moderation flags.
- Do not expose raw Google server keys to the browser.
- Do not add continuous user GPS tracking.
- Do not make 3D rendering, motion, or red/green color the only way to understand listings.
- Do not trust client-provided roles, trial dates, entitlement status, or unit-count invariants.
- Do not ship a listing workflow without moderation/reporting controls.
