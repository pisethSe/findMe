# FindMe MVP specification

Status: working specification pending brand and platform confirmation

## Product goal

Enable a student unfamiliar with Phnom Penh to find and confidently shortlist
an affordable, available rental near their university in under ten minutes.

## Primary users

### Student renter

A current or incoming university student, often moving from a province, using a
phone and possibly a slower mobile connection. Their primary task is to compare
places worth inspecting.

### Property owner or manager

An independent landlord, small building operator, or trusted agent who needs a
simple way to publish rooms, communicate availability, and receive qualified
student inquiries.

### Platform administrator

A FindMe team member who verifies identities and listings, reviews reports,
removes unsafe content, and monitors stale availability.

## Core student journey

1. Select a university or college.
2. Set a monthly budget and preferred travel radius or time.
3. Browse a synchronized list and interactive map.
4. Refine by room type, availability, gender policy, amenities, utilities,
   deposit, and verification status.
5. Open a listing and understand rent, additional costs, travel distance,
   facilities, rules, safety information, photos, and last verification date.
6. Save or compare listings.
7. Contact the owner by phone or Telegram, or request an inspection time.

Account creation should be delayed until the user saves a listing, requests an
inspection, or contacts an owner. Browsing must remain available without login.

## MVP capabilities

### Student experience

- University-first search with a searchable university directory.
- Map and list views that preserve the same filters and selected listing.
- Filters for monthly rent, total estimated monthly cost, distance, room type,
  move-in date, furnished status, Wi-Fi, private bathroom, kitchen, motorbike
  parking, security, and gender restrictions where applicable.
- Listing detail with Khmer and English-ready content structure.
- Transparent cost breakdown: base rent, deposit, electricity unit price, water,
  parking, internet, and other recurring fees.
- Saved listings and a comparison view for up to four properties.
- Phone and Telegram contact actions with a safety reminder never to send a
  deposit before verifying the property and owner.
- Report listing and report inaccurate information.

### Owner experience

- Phone-based sign-in and basic owner profile.
- Guided listing creation with an exact map pin, university proximity preview,
  photos, price breakdown, facilities, property rules, and availability.
- Listing status: draft, pending verification, active, paused, rented, rejected,
  or expired.
- Availability confirmation reminders; unconfirmed listings automatically become
  stale and eventually leave search results.
- Inquiry and inspection-request inbox.
- Basic listing performance: views, saves, contacts, and inspection requests.

### Administration

- Owner identity and phone verification queue.
- Listing review with duplicate detection inputs and map/photo checks.
- Report triage and moderation notes.
- Ability to suspend an owner, pause a listing, or request corrections with an
  audit trail.
- University and amenity management.

## Trust model

“Verified” must have a precise meaning. The MVP should expose separate signals:

- Phone verified: the owner controls the displayed number.
- Identity reviewed: an administrator reviewed submitted identification.
- Location checked: the address/map pin was checked against supporting evidence
  or an in-person visit.
- Recently confirmed: the owner reconfirmed availability within a defined period.

The interface must never imply that verification guarantees personal safety or
property quality. Exact property addresses may be partially hidden until the
student requests an inspection, balancing discovery with owner privacy.

## Ranking principles

Default ranking should be explainable and should not silently become “highest
bidder first.” Use a weighted score based on:

- match to selected university and travel preference;
- total monthly cost match;
- confirmed availability and freshness;
- verification completeness;
- listing completeness;
- student engagement quality, with anti-spam limits.

Paid promotion, if introduced, must be labelled and cannot bypass safety,
freshness, or relevance thresholds.

## Business model

Students search and contact owners for free. During validation, landlords also
list for free to solve the supply problem. After liquidity is established,
potential revenue streams are:

- owner subscription for multiple active listings and management tools;
- clearly labelled promoted placement within relevant results;
- verification or photography service;
- university or student-housing operator partnerships.

Do not charge students a search fee in the initial model.

## Explicit non-goals for version one

- Online deposits or rent payments.
- Digitally signed leases.
- Roommate matching or social profiles.
- Reviews without a verified-tenancy mechanism.
- Automated safety scores derived from weak or opaque data.
- Properties outside Phnom Penh.
- General commercial, land, or luxury real-estate listings.
- Native mobile applications.

## Success measures

### Activation

- At least 60% of new visitors select a university and view a listing.
- At least 25% of searchers save, compare, contact, or request an inspection.

### Marketplace quality

- At least 80% of searchable listings confirmed available within the last 14
  days.
- Fewer than 5% of contacted listings reported as unavailable or materially
  inaccurate.
- Median owner response time below four working hours.

### Student outcome

- Median time to a three-property shortlist below ten minutes.
- At least 70% of interviewed users say distance, full cost, and verification
  were understandable without assistance.

## Launch slice

Start with one dense university cluster rather than all Phnom Penh. A practical
pilot could cover RUPP and ITC, then add NUM, UHS, and other campuses based on
owner supply. Seed 50–100 manually verified listings before public launch so the
first student search is useful.
