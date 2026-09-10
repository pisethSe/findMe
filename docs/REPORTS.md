# Listing reports (Phase 3, step 3)

`POST /api/v1/listings/:listingId/reports` requires an authenticated, active account. All account roles may report, including accounts that have not finished role onboarding. The backend derives the reporter from the session.

Body: `reason` is one of `INACCURATE`, `UNAVAILABLE`, `SCAM_SUSPICIOUS`, `DUPLICATE`, `INAPPROPRIATE`, `OTHER`; optional `details` is trimmed text of at most 2,000 characters. Unknown fields, null details, and invalid UUIDs are rejected.

Only published, non-deleted listings belonging to active landlords and non-deleted properties can receive new reports. Zero available units are allowed so inaccurate availability can be reported. Missing and private targets both return `LISTING_NOT_FOUND`.

Success returns HTTP 201 with `{ "data": { "id": "<report UUID>", "received": true } }` and private/no-store caching. Reports, reporter identity, and moderation fields are not exposed to landlords or public readers. Reports do not automatically unpublish rentals. Admin report processing is implemented in Phase 3, step 4; see [ADMIN-MODERATION.md](ADMIN-MODERATION.md).

One open or in-review report per reporter/listing is reused on retries, including after listing withdrawal. Repeating a submission does not replace the original reason/details. Submissions serialize on the reporter's database row. Redis accelerates a limit of 10 reports per rolling hour and a one-minute same-listing cooldown; PostgreSQL enforces the same limits when Redis is unavailable. Reused open reports do not consume the limit. `REPORT_RATE_LIMITED` returns HTTP 429.

Apply migration `20260910000100_report_rate_limit_index` to index reporter/time lookups. No additional environment variables are required. The report form on rental details has optional details, native keyboard-accessible controls, pending/success states, sign-in guidance, and retryable errors.

Checks: backend `reports.test.mjs`, database-backed `reports.integration.test.mjs` (requires migrated `TEST_DATABASE_URL`), and frontend browser `reports.spec.ts`.
