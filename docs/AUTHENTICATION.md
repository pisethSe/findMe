# Authentication foundation

Phase 0 Step 3 implements email/password authentication in the NestJS API and
the matching public Next.js account screens.

## Security model

- Passwords are hashed with Argon2id. Plaintext passwords are never persisted
  or logged.
- Access tokens are HS256 JWTs with a maximum one-hour configured lifetime,
  fixed issuer/audience claims, and a default lifetime of 15 minutes.
- Refresh tokens are 256-bit opaque random values. Only a purpose-separated
  HMAC-SHA-256 digest is stored in PostgreSQL.
- Refresh sessions are revocable and rotate on every refresh. A rotated token
  cannot be replayed.
- The refresh token is sent in an HttpOnly, SameSite=Lax cookie scoped to
  /api/v1/auth. Staging and production cookies also require HTTPS.
- Cookie-backed refresh and logout requests reject untrusted browser origins.
- Every protected request re-checks the current PostgreSQL account state, so a
  suspended or deleted user cannot continue with an older access token.
- A successful password reset consumes its token atomically and revokes all
  existing refresh sessions for that user.

## API

All routes are under /api/v1.

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/me
```

Registration accepts email, password, and preferredLocale (KM or EN). It
deliberately does not accept a role. Unknown fields are rejected, including
attempts to submit role: ADMIN. The account begins with a null role and proceeds
through the server-owned role-onboarding command implemented in Phase 0 Step 4.

Successful register, login, and refresh responses return a short-lived access
token and a safe user DTO. They never expose password hashes, refresh tokens,
token hashes, or internal database entities.

## Password-reset delivery

The forgot-password action always returns the same accepted response whether or
not an active account exists. Local and test environments additionally return a
one-time developmentResetToken so the complete reset flow can be exercised
without logging tokens or configuring a mail provider. Staging and production
never return that token. A production mail-delivery adapter must be configured
as part of deployment hardening before public launch.

## Required configuration

```text
APP_ENV=local|test|staging|production
JWT_ACCESS_SECRET=<at least 32 characters>
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_SECRET=<different, at least 32 characters>
REFRESH_TOKEN_TTL_DAYS=30
PASSWORD_RESET_TTL_MINUTES=30
WEB_ORIGIN=http://localhost:3000
```

Access-token lifetimes are constrained to 60 seconds through one hour. Refresh
lifetimes are constrained to 1–90 days, and password-reset lifetimes to 1–120
minutes.

## Reusable authorization infrastructure

Future protected modules should apply AccessTokenGuard and, for role-specific
routes, RolesGuard with the Roles(...) decorator. Role checks are server side
and must still be combined with ownership and resource-state checks inside the
relevant application service.
