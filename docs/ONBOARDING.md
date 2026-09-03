# Role onboarding and landlord access

Phase 0 Step 4 makes account role and landlord trial state authoritative in the
NestJS API and PostgreSQL. The browser follows the server-provided `nextPath`;
it does not persist or infer role, onboarding completion, or entitlement state.

## Flow

1. Registration creates an account without a product role.
2. `POST /api/v1/me/onboarding/role` accepts only `STUDENT` or `LANDLORD`.
3. Student selection creates the required Student profile in the same database
   transaction and routes to `/search`.
4. Landlord selection routes to `/onboarding/landlord` without starting access.
5. `POST /api/v1/landlord/onboarding` creates the Landlord profile and its
   entitlement atomically. The server records one seven-day trial using its own
   clock.
6. Returning users read `GET /api/v1/me/onboarding` and follow its `nextPath`.

Role selection is idempotent for the existing choice. It cannot assign `ADMIN`
or switch an established role. Repeating Landlord onboarding returns the
existing profile and entitlement without replacing profile fields or restarting
trial timestamps.

## Protected API

All endpoints require a valid bearer access token.

```text
GET  /api/v1/me/onboarding
POST /api/v1/me/onboarding/role
POST /api/v1/landlord/onboarding
GET  /api/v1/landlord/entitlement
```

The Landlord endpoints also enforce the `LANDLORD` role on the server. Input
DTOs reject client-provided trial timestamps, entitlement state, verification
state, and unknown fields.

The entitlement response contains server-derived access capabilities for
listing creation, submission, publication, and availability increases. Existing
rental data remains readable after expiry. Future listing services must call
`EntitlementsService.assertRestrictedSupplyActionAllowed` inside their service
layer for every restricted supply mutation.

The seven-day period is a fixed MVP product rule rather than an environment
setting. Trial timestamps are also protected by PostgreSQL constraints and
triggers, so a second application path cannot restart or extend them.

## Frontend routes

```text
/onboarding/role
/onboarding/landlord
/landlord
/landlord/trial
/admin
```

Direct visits restore the refresh session, request current onboarding state,
and redirect unauthenticated users to `/login`. Loading, connection-error,
validation-error, success, mobile, and keyboard states are defined without
using client storage as an authorization source.
