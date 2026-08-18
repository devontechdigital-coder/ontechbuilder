# Domains

## Model

A domain belongs to one website and one tenant. Storing `tenantId` on the domain keeps tenant-scoped queries simple and explicit.

Core fields:

- `id`
- `tenantId`
- `websiteId`
- `hostname`
- `normalizedHostname`
- `status`
- `isPrimary`
- `verificationStatus`
- `verificationToken`
- `verifiedAt`
- `createdAt`
- `updatedAt`

## Status

Domain status is intentionally small:

```text
PENDING
VERIFIED
DISABLED
```

`verificationStatus` tracks the verification process separately:

```text
PENDING
VERIFIED
FAILED
```

## Normalization

The backend normalizes hostnames before storage and comparison:

- trim surrounding whitespace
- lowercase
- remove `http://` or `https://`
- remove path, query string, and fragment input
- remove one trailing dot
- validate the remaining value as a hostname

Malformed hostnames are rejected server-side. Client-provided hostnames are not accepted as canonical storage paths or ownership claims.

## Uniqueness

`normalizedHostname` is globally unique. This prevents the same domain from being attached to multiple websites or tenants at the same time.

## Primary Domain

Each website may have at most one primary domain.

PostgreSQL enforces this with a partial unique index:

```sql
CREATE UNIQUE INDEX "Domain_websiteId_primary_key"
ON "Domain"("websiteId")
WHERE "isPrimary" = true;
```

Changing the primary domain is transactional:

```text
clear previous primary for website
set selected domain as primary
commit
```

Disabling a domain also clears `isPrimary`.

## Verification Foundation

When a domain is added, the API generates a verification token and stores pending verification state.

This milestone does not perform automated DNS checks and does not call external DNS APIs. `POST /domains/:id/verify` is a foundation endpoint for state transition and later verification workflows.

## Authorization

Domain operations use the established flow:

```text
Authenticated user
+ Active tenant
+ Required role
+ Domain tenant ownership
```

`OWNER` and `ADMIN` can manage domains. `VIEWER` can read domain data. `EDITOR` does not manage sensitive domain administration in this milestone.
