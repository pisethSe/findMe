# Role onboarding and landlord access

Phase 0 Step 4 makes account role and landlord trial state authoritative in the
NestJS API and PostgreSQL. The browser follows the server-provided `nextPath`;
it does not persist or infer role, onboarding completion, or entitlement state.

## Flow

1. Registration creates an account without a product role.
2. The role screen asks in Khmer `តើអ្នកជាសិស្ស/និស្សិត ឬជាម្ចាស់ផ្ទះជួល?`; `POST /api/v1/me/onboarding/role` accepts only `STUDENT` or `LANDLORD`.
3. Student selection creates the required Student profile in the same database
   transaction and routes to `/search`.
4. Student selection also captures the student's university or college and a
   preferred search radius. Both are stored on the Student profile as search
   defaults and are re-applied on later sign-ins, so a student moving from
   another province lands directly on rentals around their own campus.
5. Landlord selection routes to `/onboarding/landlord` without starting access.
6. `POST /api/v1/landlord/onboarding` creates the Landlord profile and its
   entitlement atomically. The server records one seven-day trial using its own
   clock.
6. In Phase 1, successful first-time Landlord activation continues directly to `/landlord/listings/new` so the owner can enter the rental name/type, map location, unit availability, price, facilities, description, contact preference, and photos.
7. Returning users read `GET /api/v1/me/onboarding` and follow its normal `nextPath`; completed Landlords go to `/landlord` and are not forced back into the first-rental form.

Role selection is idempotent for the existing choice. It cannot assign `ADMIN`
or switch an established role. Repeating Landlord onboarding returns the
existing profile and entitlement without replacing profile fields or restarting
trial timestamps.

## Student campus preference

`POST /api/v1/me/onboarding/role` accepts two optional student-only fields:

```text
institutionId          UUID of an active Institution
preferredRadiusMeters  integer, 100–20000
```

Rules enforced by the server, not the browser:

- the campus must resolve to an **active** `Institution`, otherwise
  `STUDENT_INSTITUTION_INVALID`; an unknown, inactive, or foreign id is never
  stored or used as a search origin;
- the radius is bounded to the public search range, so a saved default can never
  request a radius the search API would reject;
- both fields are rejected for a `LANDLORD` request with
  `ROLE_PROFILE_FIELDS_INVALID`, mirroring the existing `displayName` rule;
- the preference is a **default only**. The student can always change campus,
  radius, and filters on `/search`, and an explicit safe `next` target still
  wins over the saved campus.

`GET /api/v1/me/onboarding` returns `studentPreference` containing the
server-derived `institutionSlug` and `preferredRadiusMeters`. It is `null` when
no campus is saved, the campus is inactive, or the account is not a student.
Landlord and Admin responses always return `null`.

After sign-in, registration, or Google OAuth, a returning student is routed to
`/search?institution=<slug>&maxDistanceKm=<km>` using that server-provided
preference, so a student from another province lands on their own campus without
re-picking it.

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

The first-rental continuation described above is Phase 1 scope. Until that
route exists, the completed Phase 0 flow safely lands on `/landlord`.
