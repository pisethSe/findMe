# Rental supply API

Phase 1 Step 1 adds the authoritative NestJS foundation for landlord-owned
properties and listings. It does not yet add the landlord form, dashboard UI,
photo upload flow, admin publication, or public PostGIS search.

## Ownership and access

Every route below requires an authenticated `LANDLORD`. The API derives the
landlord ID from the access token; request bodies cannot set it. Owned-resource
lookups return `LISTING_NOT_FOUND` for both missing listings and listings owned
by another landlord, so private resource existence is not leaked.

An active trial or access grant is required to:

- create a listing;
- submit or resubmit a listing;
- increase available inventory.

Expired landlords can still read their listings, edit safe draft metadata, and
reduce availability. They cannot create, submit, publish, or increase available
rooms. The backend service enforces this even when called outside a controller.

## Endpoints

```text
POST   /api/v1/landlord/listings
GET    /api/v1/landlord/listings?page=1&pageSize=20&status=DRAFT
GET    /api/v1/landlord/listings/:id
PATCH  /api/v1/landlord/listings/:id
PATCH  /api/v1/landlord/listings/:id/availability
POST   /api/v1/landlord/listings/:id/submit
POST   /api/v1/landlord/listings/:id/pause
POST   /api/v1/landlord/listings/:id/mark-rented
DELETE /api/v1/landlord/listings/:id
```

`GET /landlord/listings` uses explicit offset pagination and returns `page`,
`pageSize`, `total`, and `totalPages`. `DELETE` is a domain archive action; it
does not erase rental history.

## Creating the initial property and listing

Creation writes a separate `Property` and initial `Listing` in one database
transaction. A minimal request looks like:

```json
{
  "property": {
    "name": "RUPP Student Rooms",
    "addressLine": "Russian Federation Boulevard, Phnom Penh",
    "latitude": 11.569,
    "longitude": 104.8914,
    "totalUnits": 3
  },
  "titleKm": "បន្ទប់ជួលជិតសាកលវិទ្យាល័យ",
  "propertyType": "ROOM",
  "monthlyPrice": 95,
  "currency": "USD",
  "availableUnits": 2,
  "contactPreference": "IN_APP_ONLY"
}
```

The API generates the slug and derives ownership. `availableUnits` must be from
zero through `property.totalUnits`. Amenities must be active UUIDs. A listing
must have at least one Khmer or English title. Coordinates, prices, counts,
dates, field lengths, unknown fields, and enum values are validated.

Contact preferences are `IN_APP_ONLY`, `PHONE`, `TELEGRAM`, or
`PHONE_OR_TELEGRAM`. A phone/Telegram preference is accepted only when the
corresponding landlord-profile channel exists. Public contact exposure remains
a later deliberate serializer policy.

## Landlord lifecycle

```text
DRAFT          -> submit -> PENDING_REVIEW
DRAFT          -> archive -> ARCHIVED
PENDING_REVIEW -> archive -> ARCHIVED
PUBLISHED      -> pause -> PAUSED
PUBLISHED      -> mark rented -> RENTED
PAUSED         -> submit -> PENDING_REVIEW
PAUSED         -> mark rented -> RENTED
PAUSED         -> archive -> ARCHIVED
RENTED         -> submit -> PENDING_REVIEW
RENTED         -> archive -> ARCHIVED
REJECTED       -> submit -> PENDING_REVIEW
REJECTED       -> archive -> ARCHIVED
```

`PUBLISHED` can only be entered by the future moderation service. Landlords
cannot submit a zero-availability listing or send arbitrary status values.
Metadata editing is limited to `DRAFT`, `PAUSED`, `RENTED`, and `REJECTED`.
Availability may be confirmed for every non-archived state. Setting a published
listing to zero available rooms moves it to `RENTED`.

## Stable error codes

Important domain errors include:

- `LISTING_NOT_FOUND`;
- `LISTING_STATE_TRANSITION_INVALID`;
- `LISTING_AVAILABILITY_REQUIRED`;
- `AVAILABLE_UNITS_EXCEED_TOTAL`;
- `PROPERTY_CAPACITY_TOO_LOW`;
- `AMENITIES_INVALID`;
- `CONTACT_PREFERENCE_UNAVAILABLE`;
- `LANDLORD_ONBOARDING_REQUIRED`;
- `LANDLORD_ENTITLEMENT_REQUIRED`;
- `LISTING_CHANGED` for a concurrent state change.

Database constraints and triggers remain the second line of defense for user
roles, property/listing ownership, coordinates, prices, and unit capacity.
