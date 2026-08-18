# Architecture

## Stack

- TypeScript
- Next.js
- NestJS
- PostgreSQL
- Prisma
- Google Cloud Storage

The app is a multi-tenant modular monolith. PostgreSQL is the source of truth. GCS stores uploaded binaries; PostgreSQL stores metadata only.

Do not add Redis, BullMQ, Meilisearch, Nginx, or Caddy.

## Server Target

Initial production/render target:

- 512 MB RAM
- 0.5 CPU

PostgreSQL should be external or managed for this target. Uploads should go browser-to-GCS through signed upload authorization so the app server does not buffer files.

## Repository Structure

```text
stackbuilder/
  apps/
    api/          # NestJS modular monolith API
    web/          # Next.js admin/product UI shell
    renderer/     # Next.js published website renderer shell
  prisma/
    schema.prisma
    migrations/
    seed.ts
  docs/
  docker-compose.yml
  package.json
  pnpm-workspace.yaml
  tsconfig.json
```

## Backend Structure

The NestJS API is grouped by business category instead of a flat `modules/` folder. This keeps related business code together while preserving the modular-monolith architecture.

`core/` is only for cross-cutting infrastructure:

- `core/config/` validates and provides environment configuration.
- `core/database/` owns Prisma client setup and database connection helpers.
- `core/storage/` owns the object-storage abstraction and GCS/local signed-upload drivers.
- `core/security/` is reserved for future generic security infrastructure.
- `core/common/` holds generic shared API utilities such as input helpers, health checks, and development-only exception formatting.

Business logic must not be added to `core/`. Tenant-specific business rules belong in the category that owns the feature.

Implemented backend categories:

- `identity/` contains authentication, sessions, tenant membership and tenant access logic.
- `websites/` contains website and domain management. The current implementation lives in `websites/sites/` because website and domain behavior are still handled together.
- `content/` contains content-management areas. The current implementation includes `content/pages/` and `content/media/`.

Planned backend categories, not created until implementation exists:

- `builder/` for editor, component schema, renderer, and versioning logic.
- `marketing/` for forms, leads, and analytics.
- `extensions/` for plugins.
- `agency/` for clients, workspaces, and agency settings.

Root module composition should stay category-oriented:

```text
AppModule
  HealthModule
  IdentityModule
  WebsitesModule
  ContentModule
```

Avoid excessive architectural layers. For a simple feature, start with only the files needed, such as a controller, service, and test. Do not create `domain/`, `application/`, `infrastructure/`, mappers, factories, commands, or query folders until there is a concrete need.

Preferred dependency direction is identity, then websites, then content, then builder. Marketing may depend on website/content identifiers when required. Agency may coordinate across categories through clear services. Avoid circular dependencies and do not import another category's internal implementation details when a service boundary exists.

Current `apps/api/src` tree:

```text
apps/api/src/
  app.module.ts
  app.test.ts
  main.ts
  core/
    core.module.ts
    common/
      input.ts
      filters/
        development-exception.filter.ts
      health/
        health.controller.ts
        health.module.ts
        health.service.ts
        root.controller.ts
    config/
      config.provider.ts
      config.test.ts
      config.ts
    database/
      database.ts
      prisma.service.ts
    storage/
      object-storage-health.service.ts
      object-storage.service.ts
      object-storage.ts
  identity/
    identity.module.ts
    auth/
      auth.controller.ts
      auth.guard.ts
      auth.module.ts
      auth.service.ts
      auth.types.ts
      auth-context.ts
      roles.decorator.ts
      roles.guard.ts
      session.service.ts
      tenant-context.guard.ts
      *.test.ts
    tenants/
      tenant-access.service.ts
      tenants.controller.ts
      tenants.module.ts
      tenants.service.ts
      *.test.ts
  websites/
    websites.module.ts
    sites/
      sites.module.ts
      websites.controller.ts
      websites.service.ts
      websites.service.test.ts
  content/
    content.module.ts
    pages/
      pages.controller.ts
      pages.module.ts
      pages.service.ts
      pages.service.test.ts
    media/
      media.module.ts
      media-metadata.controller.ts
      media-metadata.service.ts
      media-upload.service.ts
      *.test.ts
```

API TypeScript path aliases are configured for future readable imports such as `@/core/...`, `@/identity/...`, `@/websites/...`, and `@/content/...`. Runtime-critical source currently keeps relative NodeNext-compatible imports so compiled production output remains runnable without an extra alias resolver.

## Frontend Structure

`apps/web` follows a feature-based shape:

```text
apps/web/
  app/
  features/
  components/
    ui/
    layout/
  lib/
```

Feature UI should be added under `apps/web/features/{feature}` when the feature actually exists.

`apps/renderer` is the public rendering shell. Published website rendering logic should live there when publishing/rendering features begin.

## Tenant Isolation

Tenant-owned resources carry a tenant ownership path. Backend services verify active membership and scope queries by `tenantId`.

Authentication uses PostgreSQL-backed server-side sessions. Tenant context is resolved from the authenticated session and verified against active memberships.

## Storage

Object storage code is API-local in `apps/api/src/core/storage/object-storage.ts`. The initial implementation is GCS with local signed-upload simulation for development.

Persistent user uploads must not use local filesystem storage or PostgreSQL binaries.

## Future Features

Add new backend features under the correct `apps/api/src/{business-category}/` folder. Add frontend feature UI under `apps/web/features/{feature}`. Start with only the files needed by the feature.
