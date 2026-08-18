# Websites

## Model

A website belongs to exactly one tenant. The tenant relationship is mandatory and is the ownership boundary for every website query.

Core fields:

- `id`
- `tenantId`
- `name`
- `slug`
- `status`
- `createdAt`
- `updatedAt`

## Lifecycle

Website status is intentionally small:

```text
DRAFT -> PUBLISHED -> ARCHIVED
```

`PUBLISHED` is only a lifecycle flag in this milestone. It does not perform publishing, rendering, cache invalidation, or domain routing yet.

`ARCHIVED` websites are hidden from normal list results but remain in PostgreSQL.

## Slug Rules

Website slugs are lowercase URL-safe strings. They are unique within a tenant through:

```text
(tenantId, slug)
```

The same slug may exist in different tenants.

## Tenant Ownership

Normal API requests cannot reassign `tenantId`. Website create/update/archive operations use the authenticated active tenant context, not a client-provided tenant ownership claim.

Tenant-owned website reads and writes must use:

```ts
where: {
  id: websiteId,
  tenantId: activeTenantId,
}
```

## Authorization

Current route intent:

- `OWNER` and `ADMIN`: create, update, archive websites, manage domains.
- `EDITOR`: no sensitive website/domain administration in this milestone.
- `VIEWER`: read-only website/domain access.

## Pagination

Website lists use cursor pagination with a maximum page size of 50. Endpoints must not load unlimited tenant websites into memory.

## Future Publishing Relationship

The publishing system will later consume website state, domains, pages, and rendering configuration. This milestone does not create pages, templates, rendering snapshots, or published artifacts.
