# Admin moderation (Phase 3, step 4)

Admin pages remain in Next.js; NestJS enforces `ADMIN` and active account access. New mutation transactions recheck administrator authority. PostgreSQL stores decisions and their audit records atomically. Admin pages are noindex and reads use private/no-store responses.

## Workspaces

- `/admin`: existing pending approval/rejection queue.
- `/admin/listings`: paginated inventory, title/status filters, full content/photo/location review, pause and archive actions. `?id=<UUID>` opens one rental, including reported rentals that are no longer public.
- `/admin/reports`: status-filtered report queue with links to the rental and landlord, private details and review notes.
- `/admin/users`: paginated user list, search by profile name or UUID, suspension/reactivation. Email, passwords, tokens, and student inquiry/favorite history are not returned.
- `/admin/institutions` and `/admin/amenities`: create/edit names and catalog fields, activate/deactivate records without deleting relations.

## API

All paths are prefixed `/api/v1`.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/admin/reports?status=OPEN&page=1&pageSize=20` | Reports and minimal rental context |
| PATCH | `/admin/reports/:id` | `{ expectedStatus, status, note }` |
| GET | `/admin/users?query=...&page=1&pageSize=20` | Minimal user records |
| POST | `/admin/users/:id/suspend` | `{ note }` |
| POST | `/admin/users/:id/reactivate` | `{ note }` |
| GET | `/admin/listings?status=PUBLISHED&query=...&page=1&pageSize=20` | Full moderation inventory |
| GET | `/admin/listings/:id` | Private rental review |
| POST | `/admin/listings/:id/pause` | `{ expectedStatus, note }` |
| POST | `/admin/listings/:id/archive` | `{ expectedStatus, note }` |
| GET, POST | `/admin/institutions` | Paginated reads; create institution |
| PATCH | `/admin/institutions/:id` | Save editable institution fields |
| GET, POST | `/admin/amenities` | Paginated reads; create amenity |
| PATCH | `/admin/amenities/:id` | Save editable amenity fields |

Notes are trimmed and require 3–2,000 characters. Pagination is bounded to 50 rows and 10,000 pages. Unknown body fields and invalid UUIDs/enums are rejected.

Reports move from `OPEN` to `IN_REVIEW`, `RESOLVED`, or `DISMISSED`, or from `IN_REVIEW` to either terminal status. Stale expected states and terminal rewrites return `ADMIN_STATE_CONFLICT`. Replaying the same saved status/note returns the existing result. Closing records stamps the resolving administrator and server timestamp. Report decisions do not change listing publication automatically.

Pause requires a published listing. Archive removes any non-archived listing from public supply while preserving its data. Both require the expected state; repeated actions already at the target state are harmless. Public search caches are invalidated after commit. Approval also checks active landlord and non-deleted property state.

Suspension revokes refresh sessions and pauses published rentals in the same transaction. API authentication rejects suspended accounts. Reactivation does not republish rentals, restore sessions, or extend entitlements. Administrator/self-suspension is prohibited; administrator account changes require the privileged account-management process. Repeated identical status changes do not duplicate audit records.

Catalog writes accept complete editable forms. Institution fields: `slug`, `nameKm`, `nameEn`, `type`, `addressEn`, `city`, numeric `latitude`/`longitude`, and `isActive`. Amenity fields: `key`, `nameKm`, `nameEn`, `category`, `sortOrder`, and `isActive`. Duplicate slugs/keys return `CATALOG_KEY_CONFLICT`. Existing database triggers maintain institution PostGIS coordinates. Catalog updates invalidate public search generation after commit; catalog and rental-detail reads use current PostgreSQL data.

No new environment variables or schema migrations are required for step 4. Redis outage cannot turn a committed moderation action into a failed response during cache cleanup.

## Verification

`admin-policy.test.mjs` covers report transitions and after-commit invalidation. `admin-moderation.integration.test.mjs` uses `TEST_DATABASE_URL` to check allowed/denied roles, private reads, audit writes, state conflicts, listing removal, session revocation, reactivation, catalog validation and geographic round-tripping with Redis unavailable. `admin.spec.ts` checks responsive review, notes, action errors, permission/empty/loading recovery, and catalog creation.
