# FindMe project structure

FindMe is a pnpm workspace containing two deployable applications. The folder
names follow the project's `*-part` convention without changing the approved
modular-monolith architecture.

```text
findMe/
├── frontend-part/            Next.js App Router application
│   ├── src/app/              routes and route composition
│   ├── src/features/         product UI grouped by domain
│   ├── src/domain/           temporary frontend demo rules
│   ├── src/server/           temporary demo route support
│   └── tests/                frontend/domain tests
├── backend-part/             authoritative NestJS REST API
│   ├── src/common/           cross-cutting guards, filters, and interceptors
│   ├── src/config/           validated server configuration
│   ├── src/database/         Prisma lifecycle and persistence integration
│   ├── src/modules/          domain modules and application services
│   └── tests/                backend tests
├── shared-part/
│   └── contracts/            safe shared API envelopes and public contracts
├── database-part/            canonical Prisma/PostGIS data foundation
│   ├── prisma/schema.prisma  typed relational model
│   ├── prisma/migrations/    reviewed SQL including PostGIS invariants
│   ├── prisma/seed.ts        idempotent institution and amenity seed
│   ├── tests/                static and live database invariant tests
│   └── legacy-sql/           quarantined historical schema
├── deploy-part/              Docker and environment deployment assets
├── admin-part/               admin ownership rules and operational runbooks
├── docs/                     research and supporting specifications
└── pnpm-workspace.yaml       workspace membership
```

## Ownership rules

- `frontend-part` owns presentation, routing, SEO, forms, and map UI. It does
  not own authoritative authorization or marketplace writes.
- `backend-part` owns authorization, ownership checks, state transitions,
  moderation, persistence, geographic search, and REST responses under
  `/api/v1`.
- `shared-part/contracts` contains public transport shapes only. Database
  entities and secret-bearing internal types must not be exposed here.
- `database-part` owns Prisma and reviewed PostGIS migrations. PostgreSQL is the
  durable source of truth.
- `deploy-part` owns repeatable local and production container definitions.
- Admin routes belong to `frontend-part/src/app/admin`; admin services and
  guards belong to `backend-part/src/modules/admin`. `admin-part` is not a
  separately deployed service.

## Phase 0 status

Step 1 established the workspace, preserved the existing student-facing demo,
and provided a running API skeleton. Step 2 added the canonical Prisma/PostGIS
model, migration, reference-data seed, database-enforced integrity rules,
NestJS connection lifecycle, and dependency-aware readiness check. Step 3 adds
email/password authentication, Argon2id password storage, access and refresh
sessions, password-reset token handling, reusable authentication/role guards,
and responsive public account screens. The legacy SQL is no longer a migration
source.

The next foundation slice is Step 4: one-time Student/Landlord role onboarding,
student/landlord profile activation, and the server-timed landlord entitlement
transaction.
