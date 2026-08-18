# Authentication

## Mechanism

Authentication uses email/password credentials with server-side sessions.

Passwords are hashed with bcrypt before storage. Password hashes are never returned by API responses and must never be logged.

## Session Storage

Sessions are stored in PostgreSQL in the `Session` table. The browser receives an opaque random session token in a secure cookie. PostgreSQL stores only a SHA-256 hash of that token.

Session cookies are:

- `HttpOnly`
- `Secure` in production
- `SameSite=Lax`
- expiring
- cleared on logout

No authentication state is stored in localStorage.

## Endpoints

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
```

Tenant context endpoints:

```text
GET  /tenants
GET  /tenants/current
POST /tenants/switch
```

## Request Lifecycle

```text
Browser
  -> HttpOnly session cookie
  -> NestJS AuthGuard
  -> PostgreSQL session lookup
  -> Authenticated user
  -> Active tenant membership validation
  -> Role authorization
  -> Tenant-scoped module/service query
```

## Registration

Registration creates:

- user
- organization
- tenant
- owner membership
- initial session with active tenant

This does not mean tenant equals user. It is only the initial workspace creation flow.

## Logout

Logout revokes the session row by setting `revokedAt` and clears the browser cookie.
