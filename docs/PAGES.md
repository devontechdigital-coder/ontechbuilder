# Pages

## Ownership

Pages are tenant-scoped through the ownership chain:

```text
Tenant -> Website -> Page -> PageVersion
```

Every page API derives the tenant from the authenticated session's active tenant. Clients do not send a trusted `tenantId` for page operations. The backend verifies:

- authenticated user
- active tenant
- active tenant membership
- required tenant role
- website ownership
- page ownership
- version ownership where applicable

## Page Model

`Page` stores page identity and metadata only:

- `id`
- `tenantId`
- `websiteId`
- `parentId`
- `title`
- `slug`
- `status`
- `draftVersionId`
- `publishedVersionId`
- timestamps

The page content document is not stored on `Page`. Content lives in `PageVersion`.

## Hierarchy

Hierarchy uses a simple adjacency list:

```text
Page.parentId -> Page.id
```

The service validates hierarchy changes before writing:

- a page cannot be its own parent
- circular parent relationships are rejected
- parent page must belong to the same tenant
- parent page must belong to the same website

This is intentionally simple for the initial system. The page tree endpoint loads a bounded set of indexed page rows for one website and builds the tree in memory. The current bound is 500 pages per tree request.

## Slugs And Paths

Page slugs are unique inside a website via `(websiteId, slug)`.

Slugs are not globally unique. Future nested paths can be resolved by walking slugs within one website, for example:

```text
/services/web-design
```

The database stores slugs and parent relationships. Public routing is not implemented in this milestone.

## Homepage

The homepage is identified by `Website.homePageId`, not by a magic slug such as `/`.

This keeps homepage selection explicit and avoids coupling system-page behavior to URL text. Other system pages, such as a 404 page, can follow the same explicit relationship pattern later.

## API

Implemented page endpoints:

```text
POST  /websites/:websiteId/pages
GET   /websites/:websiteId/pages
GET   /websites/:websiteId/pages/tree
GET   /websites/:websiteId/pages/resolve?path=/a/b
GET   /pages/:pageId
PATCH /pages/:pageId
POST  /pages/:pageId/archive
```

These APIs are for authenticated admin/editor UI usage. Public page rendering and production routing are future milestones.
