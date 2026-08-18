# Infrastructure

## Runtime Target

Initial application server target:

- 512 MB RAM
- 0.5 CPU

PostgreSQL may run externally as a managed database and is not required to run on the application server.

## Services

Local Docker Compose provides:

- PostgreSQL

The foundation does not provide or require Redis, BullMQ, Meilisearch, Nginx, or Caddy.

## Local Development

```bash
corepack pnpm install
corepack pnpm infra:up
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm dev
```

Local object storage uses the provider-neutral abstraction in configuration-only local mode.

## Production Shape

Recommended initial deployment:

- `apps/web`: Next.js admin/product UI app
- `apps/renderer`: Next.js published website renderer app
- `apps/api`: stateless NestJS API
- PostgreSQL: managed external database
- Object storage: Google Cloud Storage

No reverse proxy is defined in this repository. Platform routing/load balancing should be provided by the hosting environment.

## Health

The API health endpoint checks:

- PostgreSQL through Prisma
- GCS/object storage abstraction configuration

It must not expose credentials.

## Memory-Conscious Guidelines

- Keep processes few and stateless.
- Avoid colocating PostgreSQL on the 512 MB application server.
- Avoid permanent background workers until a concrete feature requires them.
- Use PostgreSQL indexes instead of a separate search service.
- Keep result sets paginated.
- Avoid large in-memory tenant/site snapshots.
- Prefer external object storage for binaries.
- Use direct browser-to-GCS uploads to avoid buffering files in the application process.

## Future Async Work

If asynchronous work becomes necessary:

- Store job records in PostgreSQL.
- Use idempotent operation records.
- Add a small runner process only when needed.
- Keep concurrency low by default.

This is not implemented in the foundation.
