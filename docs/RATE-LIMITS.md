# Rate limits (Phase 3, step 5)

NestJS applies endpoint-specific request budgets before validation and domain
work. Redis counters are shared across API instances. PostgreSQL remains the
source of truth for users, supply, inquiries, reports, and moderation.

## Request policies

Paths below are relative to `/api/v1`. Budgets use fixed windows starting with
the first admitted request, with no extension when requests are rejected.
Each named policy shares its budget across the listed routes and all target IDs,
query strings, pagination, and sort/filter choices. All applicable budgets must
permit the request. Invalid input and failed authentication consume budgets too.

| Policy             | Routes                                                                                                                                   | IP/network budget   | Additional budget                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------- |
| Registration       | `POST /auth/register`                                                                                                                    | 10/hour             | None                                |
| Login              | `POST /auth/login`                                                                                                                       | 30/15 minutes       | 10/15 minutes per normalized email  |
| Reset request      | `POST /auth/forgot-password`                                                                                                             | 10/hour             | 3/hour per normalized email         |
| Reset completion   | `POST /auth/reset-password`                                                                                                              | 10/15 minutes       | None                                |
| Session refresh    | `POST /auth/refresh`                                                                                                                     | 120/minute          | None                                |
| Rental search      | `GET /listings/search`                                                                                                                   | 120/minute          | None                                |
| Catalog            | `GET /institutions`, `GET /amenities`                                                                                                    | 240/minute combined | None                                |
| Rental details     | `GET /listings/:slug`                                                                                                                    | 600/minute          | None                                |
| Inquiry attempts   | `POST /listings/:listingId/inquiries`                                                                                                    | 120/minute          | 60/minute per authenticated account |
| Report attempts    | `POST /listings/:listingId/reports`                                                                                                      | 120/minute          | 30/minute per authenticated account |
| Upload intents     | `POST /media/upload-intents`                                                                                                             | 120/10 minutes      | 30/10 minutes per landlord          |
| Image finalization | `POST /media/:id/finalize`                                                                                                               | 120/10 minutes      | 60/10 minutes per landlord          |
| Admin writes       | All current listing approval/rejection/pause/archive, user suspension/reactivation, report processing, institution and amenity mutations | 120/minute combined | 30/minute combined per admin        |

These are MVP operational defaults in
`backend-part/src/modules/rate-limits/rate-limit.policy.ts`, not subscription
quotas. Health checks, logout, and private read routes remain outside these
policies. Rate limiting does not replace validation, role, account-state,
ownership, entitlement, or listing-state checks. Admin reads remain available
when an admin's write budget is exhausted.

The IP guard runs before authentication and DTO validation. The account
interceptor runs after all authentication/role guards and before domain work.
Account budgets use the database-verified principal supplied by the auth guard;
request fields, client role claims, and unverified JWT payloads cannot choose
the account. Login/reset email keys use trimmed lowercase text before DTO
validation and are counted identically for existing and unknown accounts.

## Successful submissions and retries

The existing [inquiry](INQUIRIES.md) and [report](REPORTS.md) limits still apply:
10 newly committed submissions per rolling hour per account, and a one-minute
cooldown for the same rental. Their Redis accelerators and serialized PostgreSQL
checks are unchanged. Retrying a committed inquiry or an open report returns its
existing receipt without spending another successful-submission slot, subject
to the higher request-attempt budgets above. Failed validation, retries, and
requests for invalid listings cannot create unbounded database work.

## Response contract

An exhausted request budget returns HTTP `429` and the normal API error envelope:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again in 42 seconds.",
    "requestId": "example-request-id",
    "fields": null,
    "retryAfterSeconds": 42
  }
}
```

`Retry-After` contains the same positive number of seconds. Errors use
`Cache-Control: private, no-store`, including catalog routes whose successful
responses may be cached. Browser CORS exposes `Retry-After` and `x-request-id`.
Clients should preserve entered form data, display the returned message, and
wait before retrying. Existing frontend error states already display API messages.
Do not automatically retry mutations in a tight loop.

The existing `INQUIRY_RATE_LIMITED` and `REPORT_RATE_LIMITED` codes remain intact;
these older submission-limit errors receive a conservative `Retry-After: 3600`
when an exact remaining window is not supplied. Their current messages still
explain both the hourly budget and the one-minute cooldown.

## Redis, privacy, and outages

The existing `REDIS_URL` is required in staging/production. The application needs
Redis permission to execute `EVAL` and its `PTTL`, `GET`, `SET`, and `INCR`
operations, in addition to existing cache/inquiry/report commands. A single-key
Lua operation checks, increments, and sets an explicit TTL atomically. Redis
owns expiry timing; API replica clock differences cannot reset the shared window.

Keys use `findme:v1:request-limit:<policy>:<scope>:<HMAC-SHA256>` and store only a
counter. HMAC identities use the existing `REFRESH_TOKEN_SECRET` with a separate
rate-limit purpose label. All API replicas must share that secret and Redis.
Raw IPs, email addresses, user IDs, credentials, request bodies, and query/location
data are not stored in these keys. Secret rotation resets request budgets; it
does not reset durable inquiry/report submission limits.

Connections and socket operations have short timeouts, offline queuing is
disabled, and a failed connection waits 30 seconds before another attempt.
Failures produce a bounded `RATE_LIMIT_STORE_UNAVAILABLE` warning containing no
connection URL, identities, or underlying exception details.

- In staging/production, authentication, upload, and admin write policies reject
  requests with `503 RATE_LIMIT_UNAVAILABLE` and `Retry-After: 30` if Redis cannot
  enforce a budget. Domain work has not started, so these requests cannot mutate
  data. Logout remains available.
- Discovery, catalog, detail, inquiry, and report request policies use a bounded
  per-process memory fallback during an outage. The durable inquiry/report spam
  checks continue to enforce their successful-submission limits across replicas.
- Local/test environments use the memory fallback for all policies if Redis is
  absent or unavailable. Rate limiting is still active in those environments.
- Fallback storage holds at most 10,000 active counters per process, removes
  expired entries, and rejects new identities with the same retryable `503` when
  full instead of evicting active counters. It is not a fleet-wide counter: a
  transition to fallback, process restart, or Redis recovery may admit a fresh
  request window. Critical deployed mutations never rely on that fallback.

Redis loss cannot delete or change durable product data. Redis recovery is
retried automatically without an API restart. Alert on sustained limiter-store
warnings and `RATE_LIMIT_UNAVAILABLE` responses.

## Reverse proxies

`TRUSTED_PROXY_CIDRS` defaults to empty (Express `trust proxy: false`). Direct
client `X-Forwarded-For`, `Forwarded`, and `X-Real-IP` headers cannot select an IP
budget. When deploying behind a proxy, set only the actual proxy IPs or CIDRs,
for example `10.0.1.10/32,10.0.1.11/32`. The parser rejects blanket `true`, hop
counts, hostnames, malformed ranges, and `/0` networks. Use a narrow allowlist;
never include public client networks.

The ingress must overwrite or correctly append forwarding headers, and network
access to the API must match the configured topology. Express walks the chain
from the socket toward the first untrusted address. IPv4 and mapped IPv6 share
a bucket; IPv6 addresses within a `/64` share a network budget to prevent privacy
address rotation from bypassing it. Users behind a campus NAT share IP budgets,
while protected actions also have separate account budgets.

Server-rendered Next.js requests currently reach the API from the frontend
server's address and share the higher rental-detail budget. They do not forward
browser IPs. Do not bypass limits by trusting arbitrary frontend-supplied identity
headers. Any future forwarding change must validate the complete ingress chain.

## Verification

The standard backend test command includes unit/HTTP coverage for expiry,
concurrency, policy isolation, email normalization, spoofed/validated proxy chains,
IPv6 normalization, account/role enforcement, retry headers, no-store errors,
bounded fallback capacity, socket timeouts, and deployed outage behavior.

Set `TEST_REDIS_URL` to an isolated Redis instance to run the real-Redis atomic
multi-instance, TTL, and key-loss tests. Without it, only that Redis-dependent
test is skipped; HTTP and fallback tests still run. The existing PostGIS suites
continue to verify inquiry/report idempotency and spam protection during Redis
outages. CI already provisions both Redis and a disposable PostGIS database.

```sh
APP_ENV=test TEST_REDIS_URL=redis://127.0.0.1:6379 \
  corepack pnpm --filter @findme/backend test
```
