# Storage

StackBuilder stores uploaded media in cloud object storage and keeps only metadata in PostgreSQL.

## Provider

The production provider is Google Cloud Storage. Business modules depend on the storage abstraction in `apps/api/src/core/storage`, not directly on the Google Cloud SDK.

Provider-specific code lives under:

```text
apps/api/src/core/storage/providers/google-cloud-storage/
```

## Configuration

Required production values:

- `OBJECT_STORAGE_DRIVER=gcs`
- `OBJECT_STORAGE_BUCKET`
- `GCS_PROJECT_ID`
- `GCS_CREDENTIALS_FILE` or both `GCS_CLIENT_EMAIL` and `GCS_PRIVATE_KEY`

Do not commit service-account JSON credentials. Prefer workload identity or a mounted credentials file in production. Never expose GCS credentials through `NEXT_PUBLIC_*` variables.

## Local Development

For local development without GCS credentials:

```text
OBJECT_STORAGE_DRIVER=local
LOCAL_SIGNED_UPLOAD_BASE_URL=http://localhost:4000/dev/storage
```

The local provider is in-memory and exists only to exercise the signed upload lifecycle. It is not persistent user upload storage.

## Signed URLs

Uploads use short-lived signed `PUT` URLs. Reads use short-lived signed read URLs. The default expiry is configured by `OBJECT_STORAGE_SIGNED_URL_EXPIRES_IN_SECONDS`.

Buckets must not be publicly writable.
