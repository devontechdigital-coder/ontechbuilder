# Publishing

## Draft Versus Published

Editing a page version does not change the published website output.

The page has two independent pointers:

```text
Page.draftVersionId
Page.publishedVersionId
```

The published pointer is the only version intended for visitor-facing rendering in future public rendering milestones.

## Authorization

Publishing uses the existing tenant authorization system.

- `OWNER` and `ADMIN` can publish through the existing role hierarchy.
- `EDITOR` can create pages and edit draft versions.
- `VIEWER` is read-only.

No second authorization system was added.

## Transaction

Publishing runs in a database transaction:

1. Verify the page belongs to the active tenant.
2. Verify the version belongs to that page.
3. Archive any previous published version for the same page.
4. Mark the selected version as `PUBLISHED`.
5. Update `Page.publishedVersionId`.
6. Clear `Page.draftVersionId` if it pointed at the published version.
7. Mark the page as `PUBLISHED`.

The database also has a partial unique index that allows only one `PUBLISHED` version per page:

```text
PageVersion_one_published_per_page_key
```

This makes the active published version unambiguous at both the application and database levels.

## API

Implemented publishing endpoint:

```text
POST /pages/:pageId/versions/:versionId/publish
```

This milestone does not implement CDN deployment, static generation, custom domain routing, cache invalidation, or public production rendering.
