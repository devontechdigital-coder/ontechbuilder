# Development Plan

## Scope

This plan reflects the corrected low-memory foundation.

Do not implement product features yet:

- Website builder
- CMS
- Leads
- Analytics
- Plugins
- Agency features

## Phase 0: Corrected Foundation

Complete:

- Remove prohibited technologies.
- Keep Next.js admin and renderer shells.
- Keep NestJS API shell.
- Keep PostgreSQL/Prisma foundation.
- Keep provider-neutral object storage abstraction.
- Keep tests for config, API startup, health, and PostgreSQL e2e connectivity.

## Phase 1: Low-Memory Baseline

Before product modules:

- Measure baseline memory for each process.
- Keep local infrastructure to PostgreSQL only.
- Avoid permanent workers.
- Avoid separate cache/search services.
- Keep Prisma queries paginated and indexed.

## Phase 2: Tenant Foundation

Implement only after this cleanup is approved:

- Tenant context helpers.
- Authorization skeleton.
- Tenant isolation tests.
- Minimal tenant/site CRUD if explicitly requested.

## Phase 3: Product Slices

Future product modules should be added one vertical slice at a time and must preserve the low-memory architecture.

## Testing Strategy

Current minimum:

- Config validation unit tests.
- API module startup test.
- Health endpoint e2e test.
- PostgreSQL/Prisma e2e connection test when PostgreSQL is running.
- Lint, typecheck, format, and production builds.

## Risks

- Next.js and NestJS together may be tight on a 512 MB server if all apps are colocated.
- Large Prisma result sets could exceed memory quickly.
- PostgreSQL-native search must be carefully indexed to avoid CPU-heavy scans.
- Image/media processing should not run in-process on the 512 MB server without a later explicit design.
- Future background work needs a constrained database-backed approach.

## Stop Point

Stop after foundation cleanup and wait for the next instruction.
