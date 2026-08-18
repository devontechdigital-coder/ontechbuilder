# Page Versions

## Separation

`Page` and `PageVersion` are separate on purpose:

- `Page` represents the stable identity and metadata of a page.
- `PageVersion` represents a content document snapshot.

This prepares the system for the future visual builder without locking the database to a premature component schema.

## Version Document

`PageVersion.content` is PostgreSQL JSONB through Prisma `Json`.

The initial API accepts a bounded JSON document. It does not validate future builder component structure yet. A conceptual document can look like:

```json
{
  "document": {
    "blocks": []
  }
}
```

## Lifecycle

Version status values:

- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

`Page.draftVersionId` points to the current draft version when one exists.
`Page.publishedVersionId` points to the active published version when one exists.

When a draft is published, the draft pointer is cleared if it points to the published version. Editors create a new draft version for later unpublished work.

## Version Numbers

Version numbers are per page.

The database enforces:

```text
(pageId, versionNumber)
```

The service assigns the next number transactionally by reading the latest version for that page and creating the next draft.

## API

Implemented version endpoints:

```text
POST  /pages/:pageId/versions
GET   /pages/:pageId/versions
GET   /pages/:pageId/versions/draft
GET   /pages/:pageId/versions/published
GET   /pages/:pageId/versions/:versionId
PATCH /pages/:pageId/versions/:versionId
```

Version history is paginated and returns metadata by default. Full content is returned only for draft/current/specific version endpoints.
