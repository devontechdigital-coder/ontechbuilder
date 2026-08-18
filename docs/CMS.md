# CMS Architecture

The CMS module manages structured content only. It does not contain visual page-builder blocks, drag/drop behavior, layout canvas state, or rendering composition logic.

## Ownership

CMS ownership follows the existing tenant-safe hierarchy:

Tenant -> Website -> Content Type -> Content Entry

The API derives the active tenant from the authenticated session. Clients must not send `tenantId`, `userId`, or ownership values in CMS request bodies.

## Database Models

`ContentType` defines a collection inside one website:

- `tenantId`, `websiteId`
- `name`, `slug`, `description`
- `status`
- timestamps

`slug` is unique per website through `@@unique([websiteId, slug])`.

`ContentField` defines one field inside a content type:

- `contentTypeId`
- `name`
- stable `slug`
- `type`
- `required`
- `position`
- optional JSONB `configuration`
- `status`

Supported field types are:

- `TEXT`
- `RICH_TEXT`
- `NUMBER`
- `BOOLEAN`
- `DATE`
- `IMAGE`
- `URL`

`ContentEntry` stores dynamic entry data in JSONB:

- `tenantId`, `websiteId`, `contentTypeId`
- `status`
- current draft data
- `draftVersionId`, `publishedVersionId`
- `createdBy`, `updatedBy`
- timestamps

`ContentEntryVersion` stores immutable version history:

- `entryId`
- `versionNumber`
- `status`
- JSONB `data`
- `createdBy`
- `createdAt`

A partial PostgreSQL unique index allows only one published version per entry.

## Validation

Entry create/update loads the active `ContentType` and active `ContentField` definitions, then validates submitted JSON:

- unknown fields are rejected
- required fields cannot be empty
- text/rich text must be strings
- number must be finite number
- boolean must be boolean
- date must parse as a date string
- URL must be HTTP/HTTPS
- image must reference an existing tenant media item

The API saves only validated fields. It does not allow arbitrary JSON to bypass field definitions.

## Draft And Published State

Entries support:

- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

Creating an entry creates version `1` as a draft. Updating an entry creates a new draft version and updates the entry's draft data. Publishing a version is transactional:

- previous published version is archived
- selected version becomes published
- entry `publishedVersionId` is updated
- draft pointer is cleared if the published version was the current draft

Editing draft content does not overwrite previous published versions.

## Field Changes

Field display names can be changed. Field slugs and types are protected after entries exist because entry JSON depends on stable field slugs. Removing a field archives the field instead of physically deleting it, so old entry/version data remains understandable.

Field reordering updates `position` values transactionally.

## Authorization

The CMS reuses the existing role guard:

- `VIEWER`: read content types, entries, versions
- `EDITOR`: create/edit/archive entries
- `ADMIN` and `OWNER`: manage content types, manage fields, publish entries

The project does not introduce a second permission system for CMS.

## API

Content types:

- `POST /websites/:websiteId/content-types`
- `GET /websites/:websiteId/content-types`
- `GET /content-types/:contentTypeId`
- `PATCH /content-types/:contentTypeId`
- `DELETE /content-types/:contentTypeId`

Fields:

- `POST /content-types/:contentTypeId/fields`
- `PATCH /content-fields/:fieldId`
- `POST /content-fields/:fieldId/reorder`
- `DELETE /content-fields/:fieldId`

Entries:

- `POST /content-types/:contentTypeId/entries`
- `GET /content-types/:contentTypeId/entries`
- `GET /content-entries/:entryId`
- `PATCH /content-entries/:entryId`
- `DELETE /content-entries/:entryId`

Versions:

- `GET /content-entries/:entryId/versions`
- `POST /content-entries/:entryId/versions/:versionId/publish`

List endpoints are paginated.

## Media Integration

Image fields store a stable media ID reference. Uploads continue to use the existing Media module and Google Cloud Storage abstraction. The CMS does not upload files directly, store binaries in PostgreSQL, or store arbitrary image URLs for image fields.

## Performance Notes

The CMS is designed for the 512 MB RAM / 0.5 CPU target:

- paginated list endpoints
- bounded JSON payload sizes
- selective Prisma `select`
- PostgreSQL indexes on tenant, website, content type, status, and version history
- no Redis, BullMQ, Meilisearch, Nginx, or Caddy

## Future Builder Boundary

The future visual builder may reference CMS content entries, but it should remain a separate module. CMS owns structured content. Builder owns visual page composition.
