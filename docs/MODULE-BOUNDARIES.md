# Module Boundaries

## Rules

- Business logic belongs inside `apps/api/src/modules/{feature}`.
- Generic API infrastructure belongs in `apps/api/src/lib`.
- Do not create broad `utils` or unrelated `services` folders.
- Modules should communicate through explicit services.
- Avoid circular dependencies between modules.
- Keep tenant-specific logic inside the relevant feature module.
- Shared code should exist only when there is real cross-application reuse.

## Current API Modules

### `modules/health`

Owns the `/health` endpoint and dependency health response.

### `modules/tenants`

Owns:

- development request context
- tenant access checks
- tenant create/list/get
- tenant membership create/list

Does not own production authentication or full RBAC.

### `modules/websites`

Owns:

- website create/list/get foundation
- domain create/list/get foundation
- tenant-scoped website/domain mutation helpers used by tests

Does not own page builder, DNS automation, or SSL automation.

### `modules/media`

Owns:

- media metadata create/list/get foundation
- upload authorization service
- tenant-scoped media mutation helpers used by tests

Does not own media library UI or synchronous image processing.

## Future API Modules

Add features as direct folders under `apps/api/src/modules`, for example:

```text
auth/
users/
domains/
pages/
builder/
templates/
cms/
forms/
leads/
analytics/
```

Only add subfolders such as `dto`, `policies`, `mappers`, or `repositories` when a module genuinely needs them.
