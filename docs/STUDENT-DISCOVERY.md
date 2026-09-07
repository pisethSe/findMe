# Student discovery

Phase 2 Steps 1 through 7 make an educational institution the required starting
point for student rental discovery, provide the authoritative rental-search API
around that origin, connect the response to a synchronized map/list interface,
progressively enhance capable devices with bounded 3D views, and provide
student-facing distance controls. PostgreSQL
remains authoritative for institution identity, active state, rental
availability, and coordinates.

## Public institution search

```text
GET /api/v1/institutions?query=:name&limit=20
GET /api/v1/institutions?slug=:slug&limit=1
```

The endpoint is public and returns active institutions only. `query` searches
Khmer name, English name, and abbreviation without case sensitivity where the
database collation supports it. `slug` resolves an exact canonical selection.
The two filters are mutually exclusive.

Input limits are enforced by the NestJS DTO:

- `query`: trimmed, 1 to 100 characters when present;
- `slug`: lowercase letters, digits, and single hyphen separators, up to 160
  characters;
- `limit`: integer from 1 to 50, defaulting to 20.

Invalid inputs use the global `VALIDATION_FAILED` response. Supplying both
`query` and `slug` returns `INSTITUTION_SEARCH_CONFLICT`. Results expose only
the public institution DTO and include the applied query, slug, limit, and
returned count in response metadata.

## Student selection flow

The landing page loads an active default institution from the API, falling
back to the first active institution when that default is unavailable. The
student can search in Khmer or English, or use an abbreviation, and must choose
a returned option before continuing. No hardcoded institution identifier is
submitted as authoritative state.

The same picker appears in the `/search` filters. It supports pointer and
keyboard selection, visible focus, active-option state beyond color, bilingual
result labels, and accessible loading, no-match, error, invalid-selection, and
retry feedback. The list and map remain usable with the selected institution
from the existing published-rental search flow.

The canonical URL parameter is `institution`:

```text
/search?institution=royal-university-of-phnom-penh&maxRentUsd=300&maxDistanceKm=5
```

Changing the institution updates that URL immediately, preserves applicable
rental filters, removes obsolete pagination, and triggers the existing
published-rental query around the newly selected coordinates. Legacy
`university` links are read for compatibility and canonicalized after their
active slug resolves. Invalid or inactive selections never bypass the backend
active-state check; the UI uses a safe active fallback and explains what
happened.

## Verification coverage

Backend integration coverage verifies English search, Khmer search, exact slug
resolution, inactive exclusion, conflicting filters, and input bounds.
Frontend tests verify request normalization, runtime response validation,
keyboard option movement, exact slug resolution, and canonical URL persistence
without dropping the student's rental filters.

## Rental search API

```text
GET /api/v1/listings/search
```

`institutionId` is required and must identify an active institution. The
server applies all geographic and marketplace eligibility rules before
returning public DTOs. Default results are non-deleted `PUBLISHED` listings
with positive available units, a publication timestamp, confirmed
availability, and an `available_from` date no later than the current Phnom Penh
calendar date.

Supported query parameters are:

- `institutionId`: required UUID;
- `radiusMeters`: integer from 100 to 20,000, default 5,000;
- `minPrice` and `maxPrice`: non-negative decimal bounds;
- `currency`: required as `USD` or `KHR` whenever price is filtered or sorted;
- `propertyType`: one rental type for backward compatibility;
- `propertyTypes`: comma-separated unique rental types, mutually exclusive
  with `propertyType`;
- `amenities`: up to 20 unique comma-separated amenity keys, all of which must
  exist on a matching listing;
- `availableBy`: real `YYYY-MM-DD` calendar date that can deliberately include
  inventory becoming available after today;
- `north`, `south`, `east`, and `west`: optional map bounds supplied together;
- `sort`: `distance`, `price_asc`, `price_desc`, or `newest`;
- `page`: 1 to 10,000;
- `pageSize`: 1 to 50.

Phnom Penh viewport bounds must define a non-empty rectangle where north is
greater than south and east is greater than west. They further narrow the
institution-radius candidates with `ST_Intersects`; they do not replace the
student's selected institution as the reference point. Radius filtering and
distance calculation use `ST_DWithin` and `ST_Distance` on the indexed PostGIS
geography columns.

Applied filters, effective availability date, viewport, sort, institution,
pagination totals, refresh time, and cache generation are returned in response
metadata. Amenity and property-type inputs are sorted before Redis key hashing,
so equivalent URLs share the same short-lived cache entry. PostgreSQL is read
directly when Redis is missing or unavailable.

Stable domain errors include `INSTITUTION_NOT_FOUND`,
`SEARCH_CURRENCY_REQUIRED`, `SEARCH_PRICE_RANGE_INVALID`,
`SEARCH_PROPERTY_TYPE_CONFLICT`, `SEARCH_AVAILABLE_BY_INVALID`,
`SEARCH_VIEWPORT_INCOMPLETE`, and `SEARCH_VIEWPORT_INVALID`. DTO shape, enum,
range, UUID, duplicate, and list-size failures use `VALIDATION_FAILED`.

The public listing serializer exposes summary fields needed by cards and map
markers, including the selected institution distance, general location,
availability date and confirmation time, active amenities, and primary image.
It does not expose the street address, landlord identity/contact details,
moderation notes, storage keys, or other private fields.

## Rental detail (Phase 2 Step 6)

`GET /api/v1/listings/:slug` returns `{ data: PublicListingDetailDto }`. The
slug is bounded to 180 lowercase alphanumeric/hyphen characters. Optional
`institutionId` must be a single UUID for an active institution; distance is
calculated by PostGIS and rounded to metres. Without an institution, both
`institution` and `distanceMeters` are `null`.

Only published, non-deleted listings with positive available inventory,
publication/confirmation timestamps, a non-deleted property, and an active,
non-deleted landlord are readable. Draft, pending, paused, rented, rejected,
archived, deleted, and zero-availability listings all receive the same
`404 LISTING_NOT_FOUND` response. Future move-in dates remain inspectable on a
direct public detail link and are explicitly labelled “Available from”; default
search continues to exclude them. Invalid queries return `VALIDATION_FAILED`;
missing/inactive origins return `INSTITUTION_NOT_FOUND` without rental data.

The response explicitly serializes rental facts, address/coordinates, active
amenities, and ordered `READY` photos. It excludes account email/IDs, property
IDs, image storage keys/status, moderation notes, credentials, and entitlement
data. Public phone and Telegram values are included only when the listing's
server-stored contact preference permits that channel. `IN_APP_ONLY` exposes
neither. Favorites are implemented in Phase 3 Step 1; see [Student favorites](FAVORITES.md).
Phase 3 Step 2 adds private [inquiry submission and inboxes](INQUIRIES.md).

Search card titles link to `/rentals/[slug]` with the selected institution slug
and an internal `/search` return URL retaining filters, page, and viewport.
External, malformed, duplicate, oversized, or non-search return targets fall
back to `/search`. The page shows bilingual title/description/rules, ordered
photos with previous/next controls, per-photo retry, and missing/broken-photo states, monthly
rent, zero/missing deposits, utility notes, furnishing, bedrooms/bathrooms,
amenities, available units, confirmation/update dates, and the landlord's
public contact actions. Address and school-relative distance remain readable
without a map; an explicit Google Maps link opens the stored location. No
location permission, route API call, or continuous tracking is introduced.

Detail reads use `Cache-Control: no-store` and uncached server fetches with a
10-second request timeout. A visible page refreshes on the same bounded cadence
as search and on visibility/page restoration, so withdrawal removes the
detail/contact surface. The route has loading, generic retry, and unavailable
states. HTML text is escaped by React; landlord text is never rendered as HTML.
Gallery selection resets when the photo collection changes.

Set frontend-runtime `SITE_URL` to the public website origin for a per-rental
canonical/OG URL without search parameters. Without it locally, absolute URLs
are omitted, not fabricated. Titles/descriptions and available photo metadata
are server-rendered; unavailable rentals are noindex. Optional server-only
`API_INTERNAL_BASE_URL` supports container-to-container SSR; browser requests
still use `NEXT_PUBLIC_API_BASE_URL`. `CDN_BASE_URL` remains the image allowlist.

Automated tests cover DTO validation, visibility denials, contact privacy,
ordered ready photos, inactive amenities, actual PostGIS distances, future
availability, safe return/contact URLs, money/date formatting, and malformed
API responses. Set `TEST_FRONTEND_BASE_URL` for the optional production-SSR
assertions in `backend-part/tests/listing-detail.integration.test.mjs`; both
the frontend's API and test process must use the same disposable
`TEST_DATABASE_URL`. These assertions check real HTML metadata, escaped
landlord text, secret exclusion, and unavailable/noindex output.

Connected Chrome QA checked 320/390 px phones, a 768 px tablet, and a 1440 px
desktop against isolated local records. It verified photo loading/navigation,
missing and failed photos, keyboard focus, Khmer content, zero/missing deposits,
contact URLs (without initiating calls/messages), preserved return filters,
service-error retry, and automatic removal of withdrawn listings/contact links.
Synthetic placeholder images were used only in the disposable QA database,
not seeded or hardcoded into the application. Existing Chrome extensions
produced attribute-injection/hydration warnings; these were not suppressed.
Live object-storage uploads, external contact destinations, Docker smoke tests,
and live Google Maps credentials were not exercised by this local detail QA.

## Distance filters (Phase 2 Step 5)

The search filters offer 1, 2, 3, 5, 10, and 20 km presets and a labelled custom
distance input. Presets change the draft value; **Update results** applies it.
Custom values support 0.1–20 km with up to three decimal places (one-metre
increments). The input is required, has linked helper/error text, and retains
native form validation. Presets are keyboard-accessible buttons with pressed
state and a visible selected treatment that does not rely on color alone.
They wrap into two rows on small screens.

The canonical URL parameter remains `maxDistanceKm`, defaulting to 5 when
absent. The page parses decimal text to exact integer metres before calling
the API, so a value such as `1.001` produces `radiusMeters=1001`. Empty,
duplicate, non-decimal, out-of-range, and sub-metre-precision URL values show a
warning and use the safe 5 km default; they never send an invalid radius to
the backend. API response radii must also be bounded integer metres.

Submitting the form clears old map bounds and returns to page one. When there
are no matches, **Widen search** applies the next larger preset, preserves the
applied institution/budget/type, and clears the previous viewport and page.
The action stops at 20 km, where recovery suggests changing the budget, rental
type, or institution instead. URL-backed filters can be shared and restored;
distance controls remount to the applied radius after navigation. Superseded
requests cannot overwrite the newer radius results.

Both filters and result summaries explicitly identify distance as straight-line
distance from the selected institution, not walking/driving distance or travel
time. The maximum radius is displayed without rounding away custom precision.
There are no browser-side radius calculations, location-permission requests,
or paid Routes calls. Existing server-side `ST_DWithin` eligibility and
`ST_Distance` ordering still apply before pagination; a map viewport only
narrows that radius.

Automated tests cover all 19,901 supported integer-metre round trips, invalid
and duplicate URLs, bounded widening, preserved filters, reset bounds/pages,
and API response validation. Backend DTO and real PostGIS integration tests
cover minimum/default/maximum radii, candidates immediately inside/outside an
integer-metre boundary, accurate totals, invalid request errors, and radius
intersection with viewport bounds. Connected Chrome checks against a disposable
local PostGIS database verified 320/390 px phone, 768 px tablet, and 1440 px
desktop layouts, keyboard focus, invalid-input feedback, exact 101-metre
searches, preset application, budget/type preservation when widening, the
20 km limit, API-error recovery, and browser back/forward behavior. A restored
back-forward-cache page now resets the distance draft to its applied value.
Maps-disabled/list fallback was checked; live Google Maps credentials were not
configured for this local run.

## Synchronized map and list

The search page renders one API result page into both rental cards and Google
Maps markers. The institution has its own labelled origin marker. Every rental
marker includes a visible availability check and price, while the selected
marker also changes shape/outline and displays a selected label. Selecting a
card focuses its marker and opens the map on a small phone; selecting a marker
returns to and focuses the matching card. Both directions use listing IDs, and
reduced-motion users receive an instant handoff.

Map movement is treated as a new server search, not browser-side filtering.
User pan, zoom, touch, and keyboard map movement wait for a 450 ms quiet period,
then send `north`, `south`, `east`, and `west` to the existing PostGIS endpoint.
An in-flight search is aborted when a newer institution, filter, page, viewport,
or visibility refresh supersedes it. Programmatic fit and card-focus movement do
not create new viewport searches.

Effective viewport coordinates and result pages are written to the URL, so the
state can be shared and restored. Map moves replace the current history entry;
explicit page moves create history entries. Changing institutions, submitting
the main filters, clearing the map area, or resetting filters removes stale map
bounds and returns to page one. Each result page contains at most 12 cards and
markers, with accurate visible/total counts and bounded previous/next controls.

On phones and tablets up to 960 px wide, the list is the default and a
full-width List/Map control exposes one view at a time. Google Maps being disabled, slow, misconfigured, or unavailable
never hides the cards. The map panel explains the fallback and retains a way to
clear a shared viewport. Loading keeps stable map/list dimensions; empty states
offer full-radius and filter-reset recovery; failed background refreshes retain
the last complete result page.

## Progressive 3D enhancement

The landing map starts as a stable, labelled 2D preview and keeps its dimensions
while enhancements initialize. It loads Google Maps 3D only when the preview is
near the viewport and the browser has complete Maps configuration, hardware
WebGL, sufficient device capacity, no data-saving preference, and a suitable
connection. Once the scene reports a steady render, a bounded set of institution
and rental markers is added. The single 1.8-second camera move stops immediately
on pointer, wheel, keyboard, or page-visibility interaction. Rental state uses a
check or cross and an explicit label in addition to green or red.

Student search remains a 2D PostGIS viewport-search experience by default. A
student can explicitly select “3D explore” to render only the current paginated
API results, then select the same listing IDs used by the cards and 2D markers.
The 2D map remains mounted for an instant return and is the only map mode that
changes geographic search bounds. Card-to-map focus in 3D uses one finite,
interruptible camera movement and never becomes continuous tracking.

Scene initialization is independent of the 45-second inventory refresh, so
unchanged results do not recreate the map, reset its camera, or repeat a focus
animation. Changed result coordinates update the existing scene, with framing
that accounts for the full supported 20km radius and the panel's aspect ratio.
Search creates at most 24 rental markers (the current page size is 12), plus
the institution marker. An off-screen search panel releases its 3D scene.

One 15-second deadline covers the Google script, library downloads, and first
steady render. A timeout, provider error, or lost rendering context disposes
the failed scene and returns to the fallback. Cleanup cancels timers, removes
listeners, and stops camera motion. The hidden 2D map and loading 3D host are
inert, and fallback transitions preserve keyboard focus where possible.

Reduced-motion, data-saving, slow-connection, low-power, or unsupported devices
do not download the 3D scene. Missing configuration, provider errors, invalid
map IDs, and render timeouts also return to the stable 2D surface. The complete
rental list is never removed, and search never depends on 3D support.

### Verification status

Automated coverage checks capability policy, portrait/distant-result camera
framing, initial-render readiness, load timeouts, provider/context errors, and
cleanup. Frontend type-checking, linting, tests, and the production build pass.
The live Google Maps rendering and manual phone/tablet/desktop checks remain
unverified because no connected browser was available during this implementation.


## Mobile responsiveness (Phase 2 Step 7)

Student discovery uses cards first at widths through 960 px, including portrait
tablets and landscape phones. List/Map controls expose one view at a time;
wider screens retain the synchronized map/list split. The loading skeleton
follows the same list-first layout. Selecting a card moves keyboard focus to
the map panel, including when Maps is disabled or failed. The fallback has an
explicit **Back to rental list** action with focus restoration. Map frames are
bounded for short landscape viewports, and selected controls keep visible
inset focus outlines.

The institution picker stays visible above results. On compact screens, a
summary of the applied budget, distance, and type sits beside **Filters**.
This opens a native modal **Search filters** dialog with a scrollable form,
labelled controls, and a persistent **Cancel** action. Native focus containment
and Escape dismissal are preserved. Cancel discards edits and returns focus to
Filters; widening the viewport beyond 960 px closes the dialog and focuses
the inline form. Applying filters uses the existing GET URL contract, retains
the selected institution, and clears old map bounds and pagination. Invalid
distance input keeps the dialog open and identifies the field to correct.
The background cannot scroll while the dialog is open.

Inputs and selects use at least 16 px text to avoid mobile input zoom. Key
navigation, view, map, and filter controls have at least 44 px touch targets.
Long institution names, Khmer titles, prices, addresses, and amenities wrap
without horizontal page scrolling. Keyboard navigation keeps the active
institution option within its scrollable result list. Rental card image sizes
match the full-width compact layout and the wider desktop result column.
Landing copy/actions precede the map, and rental details retain their existing
single-column photo, summary, and facts order on phones and tablets below
800 px. The search route error action uses the installed Next.js `retry` API.

Run the deterministic browser checks with:

```bash
corepack pnpm --filter @findme/frontend exec playwright install chromium
corepack pnpm --filter @findme/frontend run test:browser
```

The suite starts a dedicated fixture HTTP API on port 3102 and a Next.js dev
server on port 3100. Stop any existing frontend dev server first because Next
uses a shared development lock. All synthetic records/images live exclusively
under `frontend-part/tests/browser`; production discovery still reads NestJS.
Browser results and failure traces are ignored by Git. No database, live Maps
credentials, or outbound phone/Telegram actions are required.


Step 7 verification: all nine Chromium browser tests pass across 320×740,
390×844, 768×1024, 844×390, 960×800, and 1440×1000 viewports. Screenshot review
checked landing, compact filters and invalid-input feedback, search cards,
loading/empty/error recovery, map fallback, rental detail, and unavailable
rentals. Keyboard checks cover Tab containment, Escape/cancel focus restoration,
map/list handoff, and scrolling the active institution option. The 82 frontend
unit tests, formatting, lint, type-checking, and production build also pass.
These are local viewport-emulation checks with isolated API/image fixtures;
physical mobile devices, Safari, and live Google Maps rendering were not tested.
