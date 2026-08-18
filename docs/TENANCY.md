# Tenancy

## Model

A tenant is an isolated customer workspace. A tenant is not a user.

Users join tenants through `TenantMember` records. A user can belong to multiple tenants, and a tenant can have multiple users.

## Active Tenant Context

Authenticated sessions may store an `activeTenantId`. The API resolves the active tenant by checking:

```text
Session
  -> User
  -> TenantMember
  -> Active Tenant
```

The active tenant is valid only when the user has an active membership for that tenant.

## Tenant Switching

Users switch tenants through:

```text
POST /tenants/switch
```

The submitted tenant ID is not trusted. The backend validates it against the authenticated user's active memberships before updating the PostgreSQL session.

## Protected Resource Pattern

Every protected tenant-owned operation must have:

```text
Authenticated User
+ Active Tenant
+ Required Role
+ Resource Tenant Ownership
```

Resource queries must include tenant scope:

```ts
where: {
  id: websiteId,
  tenantId: activeTenantId,
}
```

The frontend is not trusted to enforce tenancy. Backend guards and services are authoritative.

## Current Guards

- `AuthGuard`: resolves the session cookie and authenticated user.
- `TenantContextGuard`: requires active tenant context and prevents route tenant spoofing.
- `RolesGuard`: enforces the minimum tenant role for a route.

## Tenant-Owned Resources

```text
Tenant
  -> TenantMember
  -> Website
       -> Domain
       -> Media
  -> Media
```
