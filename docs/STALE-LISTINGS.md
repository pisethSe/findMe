# Stale-listing controls (Phase 4 Step 3)

Availability must be confirmed at least every **14 days**. The landlord dashboard
starts reminding the owner after **7 days**. These are elapsed 24-hour days,
measured from `availability_confirmed_at` with server time. At exactly 14 days,
the confirmation is stale. Missing or future confirmations are not current.
This implements the MVP's current-inventory requirement without adding an
archive/renewal workflow or an outbound notification service.

## Student visibility

Search rows and totals, public details, new favorites, and new inquiries require
current confirmation in addition to their existing publication, inventory, and
permission checks. The client cannot override the cutoff with `availableBy`, a
query parameter, or an old listing URL. Stale detail/inquiry targets return the
existing `LISTING_NOT_FOUND` response without leaking private data.

Saved favorites and inquiry history survive. Their listing projection becomes
`null` while the listing is hidden. Students can remove saved rows, and retries
of an already accepted inquiry return its original result without sending again.
Landlords retain their listing data and inquiry inbox.

Reports intentionally retain their existing eligibility: a published rental can
still be reported as inaccurate even when its inventory is zero or its availability
confirmation is stale. Reporting never exposes the listing's private content.

Filtering happens on reads and does not depend on a cron job, Redis, a landlord
visit, or a database status update. No new listing status or migration is needed.
The existing partial public-search index remains usable with the timestamp range.

Search caches retain their 30-second TTL. Cached pages containing a card that has
crossed the deadline are re-queried immediately; aggregate counts for other pages
may lag for up to the TTL. Active student views keep the existing bounded refetch,
with the normal 60-second visibility target. Public detail and inquiry validation
are uncached. Confirmation of a published listing invalidates public search
caches only after its database transaction commits.

## Landlord confirmation

`PATCH /api/v1/landlord/listings/:id/availability` still accepts only:

```json
{ "availableUnits": 2 }
```

An unchanged count is an explicit confirmation. The backend assigns the timestamp
and returns the owned listing. All owned listing DTOs, including admin moderation
projections, now include:

```json
{
  "availabilityFreshness": {
    "state": "DUE",
    "remindAt": "2026-09-08T00:00:00.000Z",
    "expiresAt": "2026-09-15T00:00:00.000Z"
  }
}
```

States are `FRESH`, `DUE`, `STALE`, and `UNCONFIRMED`; the last has null deadlines.
This is evaluated from server time for each response. The dashboard presents
these states with text, a Cambodia-time deadline, and a **Confirm** button when
the room count has not changed. Editing the count uses **Save**. Failed requests
retain the input and reminder; success uses the returned server state.

Ownership, role, non-archived state, and room-count bounds remain mandatory.
Entitlement expiry is resolved before confirming availability. Expired landlords
may keep/reduce rooms on their paused listings, but cannot increase inventory or
restore visibility. The final write checks the expected status and room count;
positive published confirmation and any inventory increase also require active
access at the database write. A conflicting change returns `LISTING_CHANGED`
without refreshing availability or invalidating public caches.

Confirmation does not unpause, relist, resubmit, or bypass moderation. A stale
listing that is still `PUBLISHED` can return to discovery after its active owner
confirms availability. Paused/rejected/rented/draft listings keep their state.
Setting a published listing's count to zero still moves it to `RENTED`.
Metadata edits do not reset freshness. Submission explicitly confirms availability.

Admin approval requires a current confirmation and checks it again in the write.
A stale pending listing returns `LISTING_AVAILABILITY_STALE`; the owner can confirm
it in the dashboard and the admin can then review it again. Approval never invents
a new landlord confirmation timestamp.

## Verification and rollout

`availability-policy.test.mjs` covers exact 7/14-day boundaries, missing/invalid/
future timestamps, and cached cards crossing the deadline.
`stale-listings.integration.test.mjs` exercises real HTTP and PostgreSQL behavior:
visibility and totals, details, favorites, private inquiry history and retry,
authorization, injected fields, equal-count recovery, moderation, metadata edits,
non-public states, expiry without waiting for a runner, and a conflicting count.
`stale-listings.spec.ts` covers reminders, unchanged counts, keyboard submission,
saving/error/retry states, paused/archived access, persistence after reload, and
320/390/768/1440-pixel layouts with Khmer titles.

Run the repository checks described in [TESTING.md](TESTING.md). This change
requires no new environment variable, dependency, migration, or scheduled worker.
Deploy backend and frontend together because owned listing responses gain required
freshness metadata. Existing listings already older than 14 days become hidden
on deployment until their owners confirm them. Do not backfill confirmations from
`updated_at` or deployment time: neither represents a landlord confirmation.
