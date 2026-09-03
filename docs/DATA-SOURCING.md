# Rental data sourcing

## Source of truth

FindMe, backed by PostgreSQL/PostGIS, is the source of truth for rental
listings. Google Maps supplies map rendering, place selection, geocoding, and a
Google Place ID where available. Google Maps is not imported or scraped to
create marketplace inventory.

The only supported listing sources are:

- `demo`: fictional development records with plausible Phnom Penh coordinates;
- `landlord`: a listing submitted by an authenticated landlord through FindMe.

Demo records must always be labelled and must never be represented as active
real-world advertising.

## Landlord-to-student publication flow

1. An authenticated landlord creates a property and listing.
2. The landlord searches for an address or moves the Google Maps marker.
3. FindMe stores the landlord-provided address, latitude, longitude, PostGIS
   point, and Google Place ID when available.
4. The landlord records price, units, amenities, photos, and availability.
5. The backend validates ownership, landlord entitlement, unit-count invariants,
   and the listing state transition.
6. Moderation approves the listing and transitions it to `PUBLISHED`.
7. The next PostGIS search query includes the listing immediately when it is
   published, available, and inside the requested bounds/radius.

The web client should refetch after a landlord mutation, when a student changes
filters or map bounds, when the browser regains focus, and at a restrained
interval while the search screen remains active. WebSockets are not required
for MVP correctness.

## Google data handling

Store only data allowed by the applicable Google Maps Platform terms. A Google
Place ID may be retained as an external reference. Do not bulk import Places
results, reviews, photos, phone numbers, or business listing content into the
FindMe rental database.
