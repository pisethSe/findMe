# Student discovery

Phase 2 Steps 1 and 2 make an educational institution the required starting
point for student rental discovery and provide the authoritative rental-search
API around that origin. PostgreSQL remains authoritative for institution
identity, active state, rental availability, and coordinates.

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
