# Tech Stack

## Locked Stack

- TypeScript
- Next.js
- NestJS
- PostgreSQL
- Prisma
- Google Cloud Storage

Do not add Redis, BullMQ, Meilisearch, Nginx, or Caddy.

## Applications

| Path            | Role                                      |
| --------------- | ----------------------------------------- |
| `apps/api`      | NestJS modular monolith API               |
| `apps/web`      | Next.js admin/product UI shell            |
| `apps/renderer` | Next.js published website rendering shell |

## Root Infrastructure

| Path                   | Role                       |
| ---------------------- | -------------------------- |
| `prisma/schema.prisma` | Prisma schema              |
| `prisma/migrations`    | Database migrations        |
| `prisma/seed.ts`       | Development-only seed      |
| `docker-compose.yml`   | Local PostgreSQL           |
| `docs/`                | Architecture documentation |

## API Local Infrastructure

Generic API helpers live in `apps/api/src/lib`:

- config validation
- Prisma client helpers
- object storage abstraction and GCS implementation
- Nest platform providers

Business logic belongs in `apps/api/src/modules`.

## Storage

Persistent uploads use Google Cloud Storage. The API creates signed upload authorizations and stores metadata in PostgreSQL.

Local development may use signed upload simulation, but persistent user uploads must not use local filesystem storage.
