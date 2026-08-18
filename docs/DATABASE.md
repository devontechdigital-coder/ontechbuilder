# Database Architecture

## Source Of Truth

PostgreSQL is the source of truth. Prisma owns schema definition, migrations, generated types, and database access helpers.

Google Cloud Storage stores file binaries. PostgreSQL stores media metadata and object keys only.

## Current Entities

- `User`: foundational account/profile record with unique email and optional display name.
- `Session`: PostgreSQL-backed server-side session with hashed token and optional active tenant.
- `Organization`: internal grouping record that can own tenants.
- `OrganizationMember`: organization-level membership foundation.
- `Tenant`: isolated customer workspace with `name`, `slug`, `status`, and timestamps.
- `TenantMember`: user-to-tenant membership with role and status.
- `Website`: tenant-owned site shell with `name`, `slug`, `status`, and timestamps.
- `Domain`: tenant-owned domain attached to a website.
- `Media`: tenant-owned media/file metadata, optionally attached to a website.
- `AuditLog`: placeholder foundation for future audit events.

## Relationships

```text
Organization
  -> Tenant
Tenant
  -> TenantMember -> User
  -> Website
       -> Domain
       -> Media
  -> Media
User
  -> Session
```

`Domain` carries both `tenantId` and `websiteId` so tenant ownership is queryable without joining through `Website`. `Media` carries `tenantId` and optional `websiteId`.

## Status And Role Enums

The schema uses enums instead of loose strings:

- `TenantStatus`: `ACTIVE`, `SUSPENDED`, `ARCHIVED`
- `MembershipRole`: `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`
- `MembershipStatus`: `ACTIVE`, `INVITED`, `SUSPENDED`
- `WebsiteStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `DomainStatus`: `PENDING`, `VERIFIED`, `DISABLED`
- `DomainVerificationStatus`: `PENDING`, `VERIFIED`, `FAILED`
- `MediaStatus`: `PENDING_UPLOAD`, `READY`, `FAILED`, `ARCHIVED`

This is a minimal authorization foundation, not a complete RBAC implementation.

## Tenant Isolation

Every tenant-owned model has a `tenantId` column or a direct tenant ownership path. Application services must scope tenant-owned reads and writes by tenant.

Required service pattern:

- Resolve actor from the PostgreSQL-backed authenticated session.
- Verify active membership with `TenantAccessService`.
- Query tenant-owned resources using `tenantId`.
- Select only fields required by the response.
- Use small paginated result sets.

## Important Constraints And Indexes

- `User.email` unique: account lookup.
- `Session.tokenHash` unique: session lookup without storing raw tokens.
- `Session.userId, expiresAt`: session cleanup/user-session queries.
- `Tenant.organizationId, slug` unique: tenant slug uniqueness inside an organization.
- `TenantMember.tenantId, userId` unique: prevents duplicate tenant memberships.
- `OrganizationMember.organizationId, userId` unique: prevents duplicate organization memberships.
- `Website.tenantId, slug` unique: tenant-local website identifiers.
- `Website.id, tenantId` unique: supports composite foreign keys from tenant-owned child records.
- `Domain.normalizedHostname` unique: prevents two websites claiming the same custom domain.
- Partial unique index on `Domain.websiteId` where `isPrimary = true`: one primary domain per website.
- `Media.tenantId, storageKey` unique: prevents duplicate object keys inside a tenant.
- Tenant/status and tenant/createdAt indexes: efficient tenant-scoped lists.

Indexes are intentionally conservative for the 512 MB RAM / 0.5 CPU target.

## Development Seed

Development seed entry point:

```text
corepack pnpm db:seed
```

The seed creates one development organization, tenant, user, membership, two websites, one domain, and one sample media metadata record. It refuses to run when `NODE_ENV=production`.

## Search

Use PostgreSQL-native search/indexing first. Do not add Meilisearch or another database. Future content search can use B-tree indexes, `pg_trgm`, or PostgreSQL full-text search as needed.
