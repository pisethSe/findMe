# Continuous integration

Phase 0 Step 6 is enforced by the GitHub Actions workflow at
`.github/workflows/ci.yml`. It runs for pull requests to `main`, pushes to
`main`, and manual dispatches.

## Verification contract

The `Verify workspace` job uses the repository's pinned pnpm version and the
minimum supported Node.js 24 release. It must complete all of these checks:

1. install exactly the dependencies in `pnpm-lock.yaml`;
2. check formatting and lint every workspace package;
3. validate the committed Prisma schema and migration history;
4. generate Prisma Client and type-check every TypeScript package;
5. apply the committed migrations to a disposable PostgreSQL 17 + PostGIS 3.5
   service;
6. run the reference seed twice to prove it remains idempotent;
7. run all unit and integration tests with `TEST_DATABASE_URL` present, so the
   database-backed suites cannot be skipped;
8. build the applications with production-mode environment validation enabled.

The Maps values used by the production build are synthetic configuration
fixtures. CI never needs or receives deployable Google Maps credentials.

After verification passes, `Build and smoke-test containers` validates the
Compose file, builds the frontend, backend, and migration images, starts the
complete local stack, and probes the frontend plus the API readiness endpoint.
Failure logs are printed before the stack and its disposable volume are removed.

## Run checks locally

Formatting, linting, schema validation, type-checking, unit tests, and builds
can run without infrastructure:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run format:check
corepack pnpm run lint
corepack pnpm run db:validate
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run build
```

The database tests intentionally skip when `TEST_DATABASE_URL` is absent. To
reproduce the complete CI verification, use a disposable PostGIS database and
set all three database variables to it before migrating, seeding, and testing:

```bash
export DATABASE_URL=postgresql://findme:findme_ci@127.0.0.1:5432/findme_ci
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
export TEST_DATABASE_URL="$DATABASE_URL"
corepack pnpm run db:migrate
corepack pnpm run db:seed
corepack pnpm run db:seed
corepack pnpm run test
```

Never point `TEST_DATABASE_URL` at staging or production. Integration tests
create and update records and are only safe against disposable test data.

Reproduce the container smoke check with:

```bash
docker compose -f deploy-part/compose.local.yaml up --build --detach --wait
curl --fail http://127.0.0.1:3000/api/health
curl --fail http://127.0.0.1:3001/api/v1/health/ready
docker compose -f deploy-part/compose.local.yaml down --volumes
```

## Branch protection

Repository administrators should require both workflow jobs before merging to
`main`:

- `Verify workspace`
- `Build and smoke-test containers`

The workflow has read-only repository permissions, does not persist checkout
credentials, cancels superseded runs for the same branch or pull request, and
pins third-party actions to reviewed commit SHAs.
