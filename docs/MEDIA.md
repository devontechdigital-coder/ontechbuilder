# Media

StackBuilder media is tenant-owned application metadata stored in PostgreSQL, with file bytes stored in object storage.

## Ownership And Isolation

Every media record belongs to exactly one tenant. Media APIs use the authenticated active tenant context; clients do not submit or choose `tenantId`, bucket, or storage key. Reads, listing, access URLs, and deletion all check tenant membership through the existing authorization system.

## Upload Flow

The initial flow is browser-to-storage using short-lived signed URLs:

1. Browser calls `POST /media/uploads/init`.
2. NestJS validates authentication, active tenant, role, filename, MIME type, extension, and size.
3. NestJS generates a media ID and tenant-scoped storage key.
4. NestJS returns a signed upload URL and signed upload token.
5. Browser uploads directly to object storage with `PUT`.
6. Browser calls `POST /media/uploads/:mediaId/complete`.
7. NestJS verifies the token, storage object metadata, and image file signature.
8. NestJS creates the PostgreSQL media row.

The database row is not created before the object upload completes. If DB creation fails after upload, the backend attempts to delete the uploaded object.

## Storage Key

Storage keys are server-generated:

```text
tenants/{tenantId}/media/{mediaId}/{sanitizedFilename}
```

The original filename is retained for display only. It is never trusted as a path.

## Validation

Allowed initial MIME types:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`
- `application/pdf`

SVG is excluded initially because SVG can contain active content.

Default limits:

- Images: `MEDIA_UPLOAD_MAX_IMAGE_BYTES`, default `10000000`
- General files: `MEDIA_UPLOAD_MAX_FILE_BYTES`, default `20000000`

Image completion verifies magic bytes for JPEG, PNG, WebP, and GIF without loading the whole object into memory.

## Access Model

Media supports `PRIVATE` and `PUBLIC` metadata states. New uploads default to `PRIVATE`. Browser access uses `GET /media/:id/access`, which returns a short-lived signed read URL. Buckets must not be made publicly writable.

## Deletion

Deletion is hard-delete for this milestone:

1. Verify tenant ownership and editor role.
2. Delete the storage object.
3. Delete the PostgreSQL media row.

The API does not claim success if storage deletion fails.

## API

- `POST /media/uploads/init`
- `POST /media/uploads/:mediaId/complete`
- `GET /media`
- `GET /media/:mediaId`
- `GET /media/:mediaId/access`
- `DELETE /media/:mediaId`

Listing supports `query`, `mimeType`, `limit`, and `cursor`.
