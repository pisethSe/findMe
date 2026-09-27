# Staging and production deployment

Staging runs the same two containers and the same images as local development,
but against **managed** services instead of local Docker ones, as required by
`ARCHITECTURE-ESSENTIALS.md`:

| Concern | Local (`compose.local.yaml`) | Staging (`compose.staging.yaml`) |
| --- | --- | --- |
| PostgreSQL + PostGIS | `postgis/postgis` container | Neon |
| Redis | `redis` container | Managed Redis |
| Object storage | empty / optional | S3-compatible bucket + CDN |
| `APP_ENV` | `local` (build and runtime) | `staging` (build and runtime) |
| TLS | none | host reverse proxy in front of loopback ports |
| Secrets | Compose defaults | `.env.staging` (git-ignored) |

`compose.staging.yaml` deliberately contains **no database or Redis service**.
If `DATABASE_URL` or `REDIS_URL` is missing, Compose fails at interpolation
rather than silently starting a local substitute.

## 1. One-time environment setup

1. Create a Neon branch for staging with PostGIS enabled, and note both the
   pooled and direct connection strings.
2. Create a managed Redis instance with TLS if the provider offers it
   (`rediss://` is accepted).
3. Create the S3-compatible bucket, its CDN origin, and CORS for signed browser
   `PUT` requests from the exact staging frontend origin.
4. Follow [Google Maps production setup](GOOGLE-MAPS.md) to create **separate**
   staging browser key, server key, and map ID, each restricted to staging.
5. Generate authentication secrets. Never reuse local or production values:

   ```bash
   openssl rand -base64 48   # JWT_ACCESS_SECRET
   openssl rand -base64 48   # REFRESH_TOKEN_SECRET
   ```

6. Copy the template and fill it in:

   ```bash
   cp .env.staging.example .env.staging
   ```

`.env.staging` is git-ignored. The template lists every variable the Compose
file interpolates, and each required one is written as `${NAME:?...}`, so an
empty value stops the run with a named error.

## 2. Validate before deploying

```bash
docker compose --env-file .env.staging -f deploy-part/compose.staging.yaml config --quiet
```

This resolves every `${...}` expression and fails on any missing required
value without contacting Neon, Redis, or Google.

## 3. Deploy

```bash
docker compose --env-file .env.staging -f deploy-part/compose.staging.yaml \
  up --build --detach --wait --wait-timeout 180
```

Startup order is enforced by Compose:

1. `database-migrate` runs `prisma migrate deploy` against
   `DATABASE_URL_UNPOOLED` and must exit successfully.
2. `backend` starts, runs `validateApplicationEnvironment()` in `main.ts`, and
   only then reports healthy on `GET /api/v1/health/ready`.
3. `frontend` starts after the backend is healthy.

Deploy the migration before the API. This ordering is the same rule documented
in [Basic analytics events](ANALYTICS.md) and applies to every schema change.

**Frontend builds bake configuration.** `APP_ENV`, `NEXT_PUBLIC_API_BASE_URL`,
the Maps browser key and map ID, and `CDN_BASE_URL` are build arguments, so a
configuration change to any of them requires rebuilding the frontend image:

```bash
docker compose --env-file .env.staging -f deploy-part/compose.staging.yaml build frontend
```

Backend configuration is read at runtime, so changing a backend variable only
needs a container restart.

## 4. TLS and reverse proxy

Both containers bind to `127.0.0.1` by default, so plain HTTP never faces the
internet. Put a TLS-terminating reverse proxy (Caddy, nginx, a cloud load
balancer, or a tunnel) in front of them:

- forward the public site origin to `127.0.0.1:3000`;
- forward the public API origin to `127.0.0.1:3001`;
- set `STAGING_BIND_ADDRESS` to another interface only when that proxy needs it;
- forward the real client address and set `TRUSTED_PROXY_CIDRS` to that proxy's
  IPs/CIDRs, otherwise rate limits see one shared client address. See
  [Rate limits](RATE-LIMITS.md).

`WEB_ORIGIN`, `SITE_URL`, and `NEXT_PUBLIC_API_BASE_URL` must all name the
public HTTPS origins the proxy serves. They are not interchangeable: `WEB_ORIGIN`
is the backend's allowed browser origin, `SITE_URL` drives canonical and Open
Graph URLs, and `NEXT_PUBLIC_API_BASE_URL` is what the browser calls.

## 5. Verify the deployment

```bash
# API readiness (checks database and reports dependency status)
curl --fail https://api.staging.example.com/api/v1/health/ready

# Frontend
curl --fail https://staging.example.com/api/health

# Security headers are present and HSTS is on in a deployed environment
curl -sI https://staging.example.com/ | grep -iE 'content-security-policy|strict-transport-security'
curl -sI https://api.staging.example.com/api/v1/health/ready | grep -iE 'content-security-policy|strict-transport-security'
```

Then run the product smoke checks:

- pick an institution and confirm published rentals appear in list and map;
- confirm rental detail pages render server-side with canonical URLs;
- upload a photo as a landlord (exercises the S3/CDN path);
- confirm `GET /api/v1/admin/analytics/summary` answers for an admin account
  and returns `Cache-Control: private, no-store`.

`APP_ENV=staging` also enforces, at startup, that placeholders are gone, Maps
and object storage are complete, Redis is present, and Telegram polling is off.
A misconfigured staging environment fails to start rather than running with the
development Content Security Policy or missing HSTS.

## 6. Migrations and rollbacks

- Migrations are versioned and committed under
  `database-part/prisma/migrations`; the `database-migrate` service applies them
  with `prisma migrate deploy`, which only runs unapplied migrations.
- Apply and verify a migration on a disposable database before staging when it
  changes indexes, constraints, or backfills data.
- Roll back application containers by re-running Compose against a previous
  image tag. Do **not** roll back a schema by deleting a migration from the
  history; write a forward migration instead.
- PostgreSQL remains the source of truth. Redis contents are disposable: flush
  the staging cache after a release that changes cached search responses or
  cache key shapes.

## 7. Secrets and separation

- Never share production credentials with staging or local, and never point
  test tooling at staging. See [Testing](TESTING.md).
- `.env.staging` is git-ignored; only `.env.staging.example` is committed.
- Restrict `GOOGLE_MAPS_SERVER_KEY` by backend egress IP and API, and the
  browser key by the exact staging referrer origin.
- Rotate `JWT_ACCESS_SECRET` and `REFRESH_TOKEN_SECRET` together when
  compromised; rotating them invalidates existing sessions.

## 8. Not covered by this runbook

- **The deployment platform itself.** `ARCHITECTURE.md` section 24 leaves the
  platform selectable, so this runbook assumes Compose on a host with a managed
  Neon, Redis, and object storage. A platform that replaces Compose must keep
  the same ordering (migrate, then API, then web) and the same environment
  validation.
- **Production promotion.** Staging is validated here; production reuses the
  same Compose file with `APP_ENV=production`, separate credentials, separate
  data stores, and its own Google Cloud project. This document does not
  configure production.
- **Production monitoring and alerting.** Structured JSON request logs, HTTP
  metrics, and the token-gated ops endpoint exist, but thresholds, dashboards,
  and paging remain operational work outside this repository.
