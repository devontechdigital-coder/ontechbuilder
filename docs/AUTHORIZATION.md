# Authorization

## Roles

Roles are stored on `TenantMember.role`.

Current role hierarchy:

```text
OWNER > ADMIN > EDITOR > VIEWER
```

## Role Definitions

### OWNER

Full control over the tenant. Future owner-only responsibilities include billing and critical tenant settings. Owners can manage members and websites.

### ADMIN

Can manage most tenant resources, members where allowed, and websites. Admin does not imply future billing ownership.

### EDITOR

Can manage website content and media/content-oriented resources. Editors cannot perform sensitive tenant administration.

### VIEWER

Read-only access.

## Guard Pattern

Protected routes compose:

```ts
@UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
@RequireRole(MembershipRole.ADMIN)
```

The role requirement is a minimum role. `OWNER` satisfies `ADMIN`, `EDITOR`, and `VIEWER` routes.

## Resource Isolation

Role checks are not enough. Tenant-owned resources must also be queried with tenant scope:

```ts
where: {
  id: domainId,
  tenantId: activeTenantId,
}
```

If a user is authenticated but requests another tenant's route or resource, the backend denies access before returning data.

## Current Route Intent

- Tenant list: authenticated user.
- Tenant current/switch: authenticated user with validated membership.
- Membership create/list: `ADMIN` minimum.
- Website/domain create: `ADMIN` minimum.
- Website/domain read: `VIEWER` minimum.
- Media metadata create: `EDITOR` minimum.
- Media metadata read: `VIEWER` minimum.
