# Student favorites (Phase 3 Step 1)

Implements PRD FAV-01 through FAV-04. Students can save from public search or a
rental detail page, remove a save, and review their private shortlist at
`/favorites`. Guest save links lead to sign-in and preserve a safe student
destination. Signing in does not automatically save a rental.

## API

All routes require an active, authenticated, fully onboarded `STUDENT` account.
Authorization uses the current database account, not client-supplied IDs or JWT
role claims. There is no endpoint for reading another student's favorites.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/api/v1/me/favorites` | `{ data: FavoriteDto[], meta: { page, pageSize, total, totalPages } }` |
| PUT | `/api/v1/me/favorites/:listingId` | `{ data: { listingId, saved: true } }` |
| DELETE | `/api/v1/me/favorites/:listingId` | `{ data: { listingId, saved: false } }` |

GET accepts `page` (default 1, maximum 10000), `pageSize` (default 12, maximum
50), and an optional comma-separated `listingIds` filter (1–50 unique UUIDv4s).
The filter supports one batched saved-state read for the visible search page.
Totals describe the filtered set. Sorting is saved time descending, then
listing ID ascending. Counts and records share a repeatable-read snapshot.
Out-of-range pages return an empty data array with the actual totals.

Each favorite contains `listingId`, ISO `savedAt`, and `listing`. The listing
is the public search summary without an institution-specific distance. Only
active amenities and a `READY` primary image are included. Internal user,
property, image-storage and moderation fields are never serialized.

New saves require public detail eligibility: published, not deleted, positive
availability, publication/confirmation timestamps, an undeleted property and
an active, undeleted landlord. Future move-in dates remain saveable, matching
direct public detail links. Private or missing targets share
`404 LISTING_NOT_FOUND`. Existing saves remain idempotent even after withdrawal.

When a saved rental loses public eligibility, `listing` becomes `null`; the ID
and saved date remain so the student can remove it. The API does not reveal its
former title, photos, address, contacts or private status. Hard deletion follows
the existing cascade foreign key and removes the favorite.

PUT and DELETE take no business input in the body (an empty object is accepted).
Unknown body fields, invalid IDs, duplicate query values and invalid pagination
are rejected with `VALIDATION_FAILED`. DELETE succeeds when the student's save
is already absent, including missing or withdrawn targets. Simultaneous PUTs
produce one row, preserve its original saved time, and retry serializable
transaction conflicts. No durable favorite state is stored in Redis.

Successful API responses use `Cache-Control: private, no-store`. The authenticated
browser client also uses `cache: no-store`. Client shortlist state is local to
the mounted surface and is rechecked on focus/visibility changes; session or
role failures clear the displayed private records.

## Interface

Controls communicate saved state with text and `aria-pressed`, reserve a 44px
touch target, disable during requests and show retryable failures without
claiming success. The saved page supports loading, empty, read-error,
write-error, guest, incomplete-account, non-student and unavailable-rental
states. Removing the last row on a later page returns to a valid page.

Saved-rental links are available in search and detail navigation. The shortlist
shows photos, monthly price/currency, title, location and availability, with a
single-column layout on phones. Khmer titles retain the existing font and
language attributes. Inquiry creation is implemented in [Phase 3 Step 2](INQUIRIES.md); reports remain a later step.

Sign-in and registration accept an optional `next` only for `/favorites`,
`/search`, and `/rentals/<slug>`. It is honored only when the server routes the
account to student search; incomplete onboarding preserves it until completion,
and landlord/admin destinations remain server-controlled.

## Database and verification

Apply `20260907000100_favorites_saved_order` through `corepack pnpm db:migrate`
before deployment. It adds `(student_id, created_at DESC, listing_id)` for the
actual pagination query. The existing composite primary key, student-role
trigger and foreign keys remain authoritative. No environment variables or
dependencies are added by this step.

Run the backend integration suite with `TEST_DATABASE_URL` pointing to a
disposable migrated PostGIS database. `backend-part/tests/favorites.integration.test.mjs`
tests concurrent saves, repeated remove/save, account isolation, token-claim
spoofing, unauthenticated/non-student/suspended accounts, validation, paging,
media privacy and withdrawn-listing redaction. Frontend unit tests cover runtime
response validation and safe post-auth routing. Playwright exercises search to
detail to shortlist, sign-in return, loading/error/retry/session-loss states,
pagination, keyboard controls and 320/390/768/1440px shortlist layouts.

Browser fixtures live only in tests; the application uses the real NestJS API.
Optional screenshots: `FINDME_QA_SCREENSHOTS=/tmp/findme-favorites-qa corepack pnpm
--filter @findme/frontend test:browser`.
