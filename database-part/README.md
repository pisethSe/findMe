# Database part

This directory is the canonical FindMe database package. It contains the
Prisma 7 data model, the reviewed PostgreSQL/PostGIS migration, deterministic
reference-data seed, and database contract/invariant tests.

Local commands load connection values from the repository-root `.env`. This
file is ignored by Git; do not duplicate or commit database credentials inside
individual workspace packages.

## Connection variables

- `DATABASE_URL`: pooled runtime connection used by the NestJS API. For Neon,
  use the pooled hostname.
- `DATABASE_URL_UNPOOLED`: direct connection used for migrations and seeding.
- `SHADOW_DATABASE_URL`: optional disposable database used to compare committed
  migration history with a target database.
- `TEST_DATABASE_URL`: non-production database used only by the live invariant
  test suite.

For local PostgreSQL, the first two values can be identical.

## Commands

Run these from the repository root:

```bash
corepack pnpm db:generate
corepack pnpm db:validate
corepack pnpm db:migrate
corepack pnpm db:seed
```

Run live database tests only against a disposable or non-production database:

```bash
TEST_DATABASE_URL=postgresql://user@localhost:5432/findme_test \
  corepack pnpm --filter @findme/database test
```

`legacy-sql/` is historical reference only. Never apply its migrations to a
new FindMe database.
