# Basic analytics events (Phase 3, step 6)

NestJS records anonymous product events in PostgreSQL and provides daily totals
to administrators. No browser SDK, cookies, analytics ingestion endpoint, external
analytics provider, or new environment variables are required.

## Event definitions

| Event | Counted when |
| --- | --- |
| `SEARCH_RESPONSE` | A valid institution-centered rental search completes, including a cache hit. |
| `SEARCH_ZERO_RESULTS` | That successful search has zero matching rentals in total. An empty page beyond the last result is excluded. |
| `LISTING_DETAIL_RESPONSE` | Public rental detail and any selected institution resolve successfully. |
| `FAVORITE_SAVED` | A student saves a rental that was not already saved. |
| `FAVORITE_REMOVED` | An existing saved rental is removed. |
| `INQUIRY_CREATED` | A new inquiry commits after account, listing, and spam checks. |
| `REPORT_CREATED` | A new report commits after account, listing, and spam checks. |
| `STUDENT_ROLE_SELECTED` | The account first selects the student role. |
| `LANDLORD_ROLE_SELECTED` | The account first selects the landlord role. |
| `LANDLORD_TRIAL_STARTED` | The landlord profile and one-time trial are first activated. |
| `LISTING_CREATED` | A new property/listing draft commits. |
| `LISTING_SUBMITTED` | A listing transitions into pending review, including a later resubmission. |
| `LISTING_PUBLISHED` | Moderation publishes a listing, or an authorized landlord resumes a previously published listing. |
| `LISTING_REJECTED` | Moderation rejects a pending listing. |

These are event counts, not unique people or unique rentals. Discovery events
measure successful API activity: refreshes, pagination, viewport changes,
prefetches, and automated readers can generate additional responses. They must
not be presented as unique searches, page views, click-through rates, or conversion
rates. The zero-result ratio can describe API search responses only.

The foundation intentionally does not measure session funnels, time to first
inquiry, per-student activity, listing-specific popularity, or institution-specific
usage. Those require separately scoped measurement and privacy decisions.

## Persistence and privacy

Migration `20260911000100_basic_analytics` adds the `analytics_event_name` enum
and `analytics_events` table. Each row contains only a random event ID, event
name, and a UTC calendar day supplied by the database clock. It has no user,
landlord, institution, listing, session, request, IP, contact, token, free-text,
filter, URL, or geographic fields. Exact activity timestamps are not retained.

Marketplace events append inside the same transaction as the changed data.
Rollbacks leave neither the changed marketplace state nor its event. Existing
favorite, inquiry, report, onboarding, and moderation retry rules determine
whether there was a new action. Retried receipts and unchanged state produce no
additional event. A save after removal is a new action.

Appending avoids a shared daily-counter row that would make unrelated
serializable favorite transactions conflict. The `(day, event)` index supports
bounded aggregation; no history is backfilled. Anonymous facts are retained
until an explicit maintenance policy removes them. Storage grows by one small
row per event; historical rollups/retention are follow-up operational work.

Mutation event persistence is part of the database transaction: a database failure
rolls back the mutation and returns the existing error response, allowing a safe
retry. Deploy the migration before deploying the API.

Read telemetry is best effort. Its short database transaction uses a 200 ms
statement timeout, 200 ms transaction acquisition budget, and 500 ms transaction
timeout. Failures produce a fixed, redacted warning and a 30-second per-process
cooldown while discovery continues. Read counts can therefore be incomplete
during outages or contention. Admin summary failures return an error rather than
a fabricated zero result. Redis is never the event store.

## Admin API

`GET /api/v1/admin/analytics/summary?from=2026-09-01&to=2026-09-07`

Requires an active authenticated admin, verified by the existing backend account
and role guards. Returns `Cache-Control: private, no-store`. Unknown query fields,
arrays, timestamps, and invalid calendar dates are rejected. Both dates are
required; ranges are inclusive, ordered, and limited to 31 days. Invalid ranges
return `ANALYTICS_DATE_RANGE_INVALID`. A separate read budget permits 60 requests
per minute per IP and 30 per authenticated admin, with the standard `429` and
`Retry-After` behavior.

The response has this shape (event lists abbreviated):

```json
{
  "data": {
    "totals": [{ "event": "INQUIRY_CREATED", "count": "12" }],
    "daily": [
      { "day": "2026-09-01", "events": [{ "event": "INQUIRY_CREATED", "count": "2" }] }
    ]
  },
  "meta": {
    "from": "2026-09-01",
    "to": "2026-09-07",
    "timezone": "UTC",
    "days": 7,
    "readActivity": "API_RESPONSES_INCLUDING_REFRESHES"
  }
}
```

Every requested day and every supported event is included, with `"0"` when no
event was recorded. Counts are decimal strings so PostgreSQL bigint totals
remain exact in JSON. A zero before deployment means no recorded data, not an
assertion that historical activity was absent. The endpoint exposes aggregates
only; there is no public ingestion or raw-event read API and no new dashboard UI.

## Verification

`analytics.test.mjs` covers date validation, bounded summaries, exact totals,
empty days, safe failure handling, cache hits, zero-result semantics, and invalid
discovery requests. `analytics.http.test.mjs` exercises the actual NestJS
controller, validation, auth/role guards, rate limiting, and response headers.
`analytics.integration.test.mjs` exercises real PostGIS transactions, repository
hooks, retry behavior, state transitions, rollback, event constraints, database
dates, and concurrent serializable writes. It requires `TEST_DATABASE_URL` to
point to a disposable database with all migrations applied.
