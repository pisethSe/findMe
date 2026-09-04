# Deploy part

Deployment and local infrastructure assets live here. The repository remains a
two-application modular monolith:

- `frontend-part`: Next.js web container
- `backend-part`: NestJS API container
- PostgreSQL/PostGIS: durable local database substitute for Neon
- Redis: disposable cache and rate-limit infrastructure

The official PostGIS Alpine image is currently AMD64-only, so Compose selects
`linux/amd64` explicitly. Docker Desktop uses emulation for this one local
service on Apple Silicon; application images continue to build for the host
architecture.

Start the local stack from the repository root:

```bash
docker compose -f deploy-part/compose.local.yaml up --build
```

Optional local Google Maps values are passed from the shell into the frontend
build and backend runtime. Production key creation, restriction, and
verification are documented in
[Google Maps production setup](../docs/GOOGLE-MAPS.md).

The Phase 0 CI workflow also builds this stack, waits for its health checks,
and probes the frontend and backend before every change can merge. See
[Continuous integration](../docs/CONTINUOUS-INTEGRATION.md) for the exact
contract and local reproduction commands.

The one-shot `database-migrate` service applies committed migrations after
PostgreSQL becomes healthy and before the backend starts. Seed reference data
from the host when needed:

```bash
DATABASE_URL_UNPOOLED=postgresql://findme:findme_local@localhost:5432/findme \
  corepack pnpm db:seed
```
