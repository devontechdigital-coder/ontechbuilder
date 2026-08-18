# StackBuilder

Enterprise multi-tenant website builder SaaS foundation.

## Stack

- TypeScript
- Next.js admin and public site rendering apps
- NestJS API
- PostgreSQL with Prisma
- Google Cloud Storage through an object storage abstraction

## Local Setup

1. Install Node.js 22+.
2. Enable pnpm:

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

3. Install dependencies:

```bash
corepack pnpm install
```

4. Copy environment variables:

```bash
cp .env.example .env
```

5. Start local infrastructure:

```bash
corepack pnpm infra:up
```

This starts PostgreSQL. Local development can use signed upload authorization simulation without production GCS credentials.

6. Generate Prisma client and run migrations:

```bash
corepack pnpm db:generate
corepack pnpm db:migrate
```

Optional development-only seed:

```bash
corepack pnpm db:seed
```

7. Start development apps:

```bash
corepack pnpm dev
```

Useful individual commands:

```bash
corepack pnpm dev:web
corepack pnpm dev:renderer
corepack pnpm dev:api
```

## Service URLs

- Web app: http://localhost:3000
- Renderer app: http://localhost:3001
- API health: http://localhost:4000/health
- PostgreSQL: localhost:5432

## Registration Troubleshooting

If `/register` shows failed `fetch` requests in the browser network tab, check that the API is running on port `4000`:

```bash
corepack pnpm dev:api
```

The API loads the root `.env` file during local development. If you copied `.env.example` before the database password was corrected, update your local `DATABASE_URL` to:

```text
postgresql://stackbuilder:stackbuilder@localhost:5432/stackbuilder?schema=public
```

Then run:

```bash
corepack pnpm infra:up
corepack pnpm db:migrate
corepack pnpm dev:api
corepack pnpm dev:web
```

## Upload Storage

Persistent uploaded files are stored in Google Cloud Storage. The API creates short-lived signed POST policies, and browsers upload directly to GCS. PostgreSQL stores metadata only.

Local development may use `OBJECT_STORAGE_DRIVER=local` for signed upload authorization simulation, but local filesystem storage must not be used for persistent user uploads.

## Verification

```bash
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

`test:e2e` expects PostgreSQL to be running with the value from `.env.example`.

## Environment Variables

See `.env.example` for the complete documented set. Secrets must be supplied through local `.env` or production secret management and must not be committed.

## Milestone Scope

This repository currently contains foundation infrastructure and the first multi-tenant domain layer:

- Simple monorepo structure
- Next.js web and renderer shells
- NestJS API modular monolith
- Root Prisma migration foundation
- Health checks for platform dependencies
- Tenant, user, membership, website, domain, and media metadata models
- Tenant-scoped NestJS services/controllers
- API-local config, database, and object-storage helpers

It intentionally does not implement website builder, CMS, leads, analytics, plugins, or agency product features yet.

## Project Structure

```text
apps/api/src/modules/   backend business modules
apps/api/src/lib/       generic API infrastructure
apps/web/features/      future admin/product UI features
apps/renderer/          future published website rendering
prisma/                 schema, migrations, seed
docs/                   architecture notes
```
