# Student discovery

Phase 2 Steps 1 through 4 make an educational institution the required starting
point for student rental discovery, provide the authoritative rental-search API
around that origin, connect the response to a synchronized map/list interface,
and progressively enhance capable devices with bounded 3D views. PostgreSQL
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
- `radiusMeters`: 100 to 20,000, default 5,000;
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

On phones, the list is the default and a full-width List/Map control exposes one
view at a time. Google Maps being disabled, slow, misconfigured, or unavailable
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
