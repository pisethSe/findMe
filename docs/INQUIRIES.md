# Inquiries (Phase 3 Step 2)

Students can send a private inquiry from a published rental and read their sent
history at `/inquiries`. Landlords see received inquiries in the dashboard and
manage the full inbox at `/landlord/inquiries`.

This implements INQ-01 through INQ-06. The supported notification surface is the
landlord's in-app inbox. Email, SMS and Telegram notifications remain optional
later work (INQ-07); this step does not send external messages or provide a chat
thread. A student may deliberately include contact details in their message.
Their account email and phone are never shared automatically. Landlords reply
through the contact channel the student supplies, then mark the inquiry replied.

## API contract

| Method | Endpoint | Result |
| --- | --- | --- |
| POST | `/api/v1/listings/:listingId/inquiries` | `{ data: StudentInquiryDto }`, HTTP 201 |
| GET | `/api/v1/me/inquiries` | Student inquiry page |
| GET | `/api/v1/landlord/inquiries` | Landlord inquiry page |
| PATCH | `/api/v1/landlord/inquiries/:id/status` | `{ data: LandlordInquiryDto }` |

POST requires a fully onboarded, active `STUDENT`. Its body is
`{ message, clientRequestId }`: a trimmed, nonempty message of up to 2,000
characters and a UUIDv4 identifying the submission. Listing IDs are UUIDv4s.
Unknown fields are rejected; student ID, landlord ID, status and timestamps
come from authenticated/database state.

New inquiries require a published, undeleted listing with available inventory,
publication/confirmation timestamps, an undeleted property, and an active,
undeleted landlord. Future move-in dates follow public detail eligibility and
remain eligible. Missing and private targets share `404 LISTING_NOT_FOUND`.

A durable unique `(student_id, client_request_id)` index makes retrying the same
message and listing return the original inquiry, including its original saved
time. Reusing a key with a different message or listing returns
`409 INQUIRY_REQUEST_CONFLICT`. Replays remain valid after withdrawal and do not
consume another rate-limit slot. The form retains the key when retrying a failed
request. Drafts and keys remain in memory and are cleared after account changes;
they are not written to browser storage.

GET accepts `page` (default 1, range 1–10000) and `pageSize` (range 1–50;
default 12 for students, 5 for the existing landlord dashboard). It returns
`{ data, meta: { page, pageSize, total, totalPages } }`. Both feeds sort by
`createdAt DESC, id DESC` and read counts and records in one repeatable-read
snapshot. Out-of-range pages return empty data with the actual total.

Student records contain `id`, `message`, `status`, `createdAt`, `updatedAt`, and
`listing: { id, slug, titleKm, titleEn } | null`. If the rental is no longer
public, only the student's message/status/history remain; the listing becomes
null. Landlord records retain the existing DTO: the same inquiry fields plus
`student: { displayName }` and owned `listing: { id, titleKm, titleEn,
propertyName }`. No account contact, authentication, storage or moderation
fields are serialized. Legacy messages up to the existing 4,000-character
database limit remain readable.

PATCH requires the authenticated owning landlord and accepts only
`{ status: "READ" | "RESPONDED" | "CLOSED" }`. Allowed progression:

- `NEW` → `READ`, `RESPONDED`, or `CLOSED`;
- `READ` → `RESPONDED` or `CLOSED`;
- `RESPONDED` → `CLOSED`;
- `CLOSED` is terminal.

Repeating the current state is idempotent and preserves timestamps. Server time
records read/replied/closed actions; backwards transitions return
`409 INQUIRY_STATUS_CONFLICT`. A missing or differently owned inquiry returns
the same `404 INQUIRY_NOT_FOUND`. GET does not mark messages read implicitly.
Reading and managing historical inquiries remain available after a landlord's
trial expires or their listing is withdrawn. Suspended accounts are denied.

All successful inquiry responses are `private, no-store`, and the authenticated
browser client disables caching. The inbox clears displayed private records
while rechecking the HttpOnly session on focus/visibility changes. Inquiry text
renders as escaped plain text, including Khmer and deliberate line breaks.

## Spam protection and consistency

Each student may create at most 10 inquiries in a rolling hour and one inquiry
per listing per minute. Rate-limited submissions return
`429 INQUIRY_RATE_LIMITED`; the form preserves the message and explains the
limits. A PostgreSQL row lock serializes new submissions for a student, so
concurrent requests and multiple API processes cannot bypass the limits.
Target rows are locked while validating and inserting. No notification or
Redis operation is treated as a successful database write.

Redis stores a sorted set of committed inquiry IDs, listing IDs and timestamps,
with a one-hour TTL. It can reject a known exhausted limit quickly. PostgreSQL
also checks recent durable inquiry history under the submission lock. Redis
outage, restart or reset therefore cannot erase inquiry history, create
duplicates or bypass submission limits. Connections/commands have bounded
waits and failed connections back off for 30 seconds. No message text is stored
in Redis.

## Migration and verification

Apply `20260907000200_inquiry_submission` with `corepack pnpm db:migrate` before
deploying. It adds a nullable retry UUID (legacy rows keep null), its unique
index, and the student/time/ID pagination index. Existing inquiry relationships,
role/eligibility triggers and timestamp constraints remain in place.

`REDIS_URL` remains the existing application setting. For tests, set
`TEST_DATABASE_URL` to a disposable, migrated PostGIS database and optionally
`TEST_REDIS_URL` to an isolated Redis instance. CI provisions both. Without
`TEST_REDIS_URL`, only the real Redis integration test is skipped; PostgreSQL
outage-fallback protection is still tested with the database suite.

Verification covers allowed/denied roles, ownership, current account state,
private DTOs, unavailable targets, concurrent retry keys, status timestamps,
expired-trial access, pagination, Redis TTL/boundaries and outage fallback.
Playwright covers submission/history, retained drafts after failure, replay of
a lost response, validation, rate/availability errors, empty/permission states,
status errors and retries, keyboard use, and layouts at 320, 390, 768 and 1440px.
Browser responses are isolated test fixtures; production code calls NestJS.

Optional screenshots: set `FINDME_QA_SCREENSHOTS` to a temporary directory when
running `corepack pnpm --filter @findme/frontend test:browser`.
