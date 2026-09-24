# Quality hardening: testing (Phase 4 Step 1)

The test gate combines Node unit tests, real NestJS HTTP/PostGIS/Redis integration
tests, and deterministic Playwright browser journeys. Browser fixtures live only
under `frontend-part/tests/browser`; they are not imported by product code.

## Critical behavior coverage

| Behavior                                                                                                                 | Evidence                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register/login, token rotation, password reset and session revocation                                                    | `backend-part/tests/auth.integration.test.mjs`, `auth-security.test.mjs`                                                                                              |
| Reject self-service ADMIN and established-role overwrite; activate the trial once                                        | `backend-part/tests/onboarding.integration.test.mjs`                                                                                                                  |
| Khmer role selection, student return URLs, first landlord activation and returning-account routing                       | `frontend-part/tests/browser/auth-onboarding.spec.ts`                                                                                                                 |
| Ownership, lifecycle commands, expired writes, safe reductions and preserved data                                        | `backend-part/tests/listings.integration.test.mjs`, `listing-lifecycle.test.mjs`, `entitlement-policy.test.mjs`                                                       |
| Coordinate round trips, unit constraints and atomic writes                                                               | `database-part/tests/database-invariants.test.mjs`, `backend-part/tests/listings.integration.test.mjs`                                                                |
| Published-only radius/viewport search, distance ordering, filter boundaries and audited approval                         | `backend-part/tests/publication.integration.test.mjs`, `discovery-search.test.mjs`                                                                                    |
| Favorites uniqueness/privacy, valid published inquiry targets and report deduplication                                   | `backend-part/tests/favorites.integration.test.mjs`, `inquiry-submission.integration.test.mjs`, `reports.integration.test.mjs`                                        |
| Non-admin rejection, moderation state checks, suspension and audit records                                               | `backend-part/tests/admin-moderation.integration.test.mjs`                                                                                                            |
| Redis counters/TTLs, outages, durable inquiry limits and after-commit cache behavior                                     | `backend-part/tests/rate-limits.test.mjs`, `rate-limits.http.test.mjs`, `inquiry-policy.test.mjs`, `public-cache.test.mjs`, `inquiry-submission.integration.test.mjs` |
| Rental draft/edit, unit validation, private coordinate fallback, failed-save recovery, photo-upload retry and submission | `frontend-part/tests/browser/landlord-supply.spec.ts`                                                                                                                 |
| Search/detail, favorites, inquiries, reports and admin browser flows                                                     | Existing `frontend-part/tests/browser/{responsive,favorites,inquiries,reports,admin}.spec.ts`                                                                         |
| Reduced-motion/device capability policy, 3D timeouts and cleanup                                                         | `frontend-part/tests/map-3d-{capability,session}.test.ts`                                                                                                             |

The supply browser tests check outgoing mutation payloads as well as visible
results. Upload retry must reuse the saved draft and submit once. The expired
access case uses server-provided capabilities, keeps drafts editable, and hides
restricted creation/submission/photo controls. Phone (320/390 px), tablet (768
px), and desktop (1440 px) checks cover all four wizard steps and the dashboard.
Existing discovery checks also cover landscape and compact filter focus.

## Run the complete gate

Use the pinned Node/pnpm versions from the root `package.json`. The test Compose
stack uses separate local ports, ephemeral PostgreSQL storage, and disposable
credentials. It does not start the product applications or use the local stack's
database volume.

```bash
docker compose -f deploy-part/compose.test.yaml up --detach --wait
export APP_ENV=test
export DATABASE_URL=postgresql://findme:findme_test@127.0.0.1:55432/findme_test
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
export TEST_DATABASE_URL="$DATABASE_URL"
export TEST_REDIS_URL=redis://127.0.0.1:56379
export REDIS_URL=

corepack pnpm install --frozen-lockfile
corepack pnpm run format:check
corepack pnpm run lint
corepack pnpm run db:validate
corepack pnpm run typecheck
corepack pnpm run db:migrate
corepack pnpm run db:seed
corepack pnpm run db:seed
corepack pnpm run test:ci
corepack pnpm --filter @findme/frontend exec playwright install chromium
corepack pnpm run test:browser
corepack pnpm run build

docker compose -f deploy-part/compose.test.yaml down --volumes
```

Never use staging or production for test URLs. Integration tests write and
delete records. `test:ci` rejects absent or malformed `TEST_DATABASE_URL` and
`TEST_REDIS_URL` before starting tests, preventing the optional infrastructure
suites from silently skipping in CI. It does not certify that a URL is safe or
local. `test` remains the infrastructure-optional unit/developer command.

The browser server reserves ports 3100/3102 and the Next.js development lock;
stop an existing frontend dev server first. Run a subset without the extra `--`:

```bash
corepack pnpm --filter @findme/frontend exec playwright test auth-onboarding.spec.ts landlord-supply.spec.ts
```

With `CI=true`, focused Playwright tests are forbidden and HTML/JUnit reports
are generated. Failed tests retain traces and screenshots; the workflow uploads
the report/results directories for seven days. To inspect a downloaded trace:

```bash
corepack pnpm --filter @findme/frontend exec playwright show-trace path/to/trace.zip
```

## Verification boundaries

Browser API and object-storage responses are deterministic fixtures. They test
browser behavior and request contracts; the real HTTP/database suites establish
server authorization and persistence. Browser refresh in a fixture test does not
by itself prove database durability.

Chromium runs with Maps configuration disabled and reduced motion enabled so
the list/manual-coordinate fallbacks remain required. Live Google Maps, marker
interaction with the provider, GPU rendering, real object storage, and other
browsers still require configured environment checks. Stale-listing controls,
the full accessibility/security reviews and production
monitoring remain the later Phase 4 steps.

Phase 4 Step 2 adds the large-data discovery regression and `benchmark:search`.
See [Performance](PERFORMANCE.md) for query/index measurements and the migration.


Phase 4 Step 3 adds [stale-listing controls](STALE-LISTINGS.md), with boundary/cache
unit tests, PostgreSQL/HTTP eligibility and confirmation tests, and dashboard
browser coverage at all four required widths. Run `stale-listings.spec.ts` for a
focused browser check, or the full browser suite for regression coverage.
