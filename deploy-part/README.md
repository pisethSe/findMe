# Deploy part

Deployment and local infrastructure assets live here. The repository remains a
two-application modular monolith:

- `frontend-part`: Next.js web container
- `backend-part`: NestJS API container
- PostgreSQL/PostGIS: durable local database substitute for Neon
- Redis: disposable cache and rate-limit infrastructure

Start the local stack from the repository root:

```bash
docker compose -f deploy-part/compose.local.yaml up --build
```

The one-shot `database-migrate` service applies committed migrations after
PostgreSQL becomes healthy and before the backend starts. Seed reference data
from the host when needed:

```bash
DATABASE_URL_UNPOOLED=postgresql://findme:findme_local@localhost:5432/findme \
  corepack pnpm db:seed
```
