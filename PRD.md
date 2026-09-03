# Student Rental SaaS — Product Requirements Document (PRD)

**Document status:** MVP definition

**Primary market:** Cambodia, initially Phnom Penh

**Primary audience:** Students moving to Phnom Penh for university/college, landlords/property owners, and platform administrators

**Product type:** Student-focused rental discovery and listing SaaS web application

---

## 1. Product Summary

The Student Rental SaaS is a web platform designed to help students, especially students moving from Cambodian provinces to Phnom Penh, find suitable rooms, houses, apartments, or other student-friendly rentals near their school, university, or college.

The platform is intentionally student-first. Instead of requiring a student to search across Facebook groups, TikTok posts, personal contacts, individual landlord phone numbers, and physical “For Rent” signs, the system brings rental listings into one searchable experience centered around:

- proximity to a selected university, college, or school;
- monthly rental price;
- property/room type;
- facilities and amenities;
- availability;
- map location;
- safety and trust information;
- simple communication with the landlord.

Landlords can create and manage listings, upload rental details and photos, select the rental location on Google Maps, and receive inquiries from students.

The first visit opens with a student-focused landing experience: a Khmer headline and a live rental-map preview make the value understandable before account creation. After registration or first successful sign-in, a one-time onboarding step asks the user to continue as a student or landlord. Student discovery remains free. Landlords receive a server-enforced seven-day trial for listing creation and publication.

The first release focuses on Phnom Penh and student accommodation. Expansion to the general rental market, commercial properties, land, and other cities/provinces is outside the initial MVP.

---

## 2. Problem Statement

Cambodian students who move from provincial areas to Phnom Penh for education often arrive with limited knowledge of neighborhoods around their university or college. They may not know which areas are close enough, how much rent normally costs nearby, what transportation is practical, or where suitable rooms are currently available.

Today, students may need to:

- search Facebook groups and social media posts;
- ask friends or relatives;
- call landlords one by one;
- compare information manually;
- travel around unfamiliar neighborhoods looking for rental signs;
- estimate distance to school themselves;
- determine whether old social posts are still available.

General rental platforms may contain useful properties, but they are usually organized for the broad property market rather than a student journey that starts with: **“I study here. What can I afford nearby?”**

This product solves that gap by making the educational institution the center of the rental-search experience.

---

## 3. Product Vision

> Make finding student accommodation near a university in Cambodia as simple as choosing the university, setting a budget, and exploring verified nearby rentals on a map.

---

## 4. Product Goals

### 4.1 MVP goals

1. Allow students to search rentals near a specific university, college, or school.
2. Allow students to filter rentals by price, distance, property type, amenities, and availability.
3. Show rental listings and educational institutions on an interactive Google Map.
4. Allow landlords to create, edit, publish, pause, and manage their rental listings.
5. Allow landlords to place a property accurately on the map.
6. Allow students to save/favorite rentals.
7. Allow students to contact or send an inquiry to a landlord without exposing unnecessary personal information publicly.
8. Provide an admin moderation workflow for users and listings.
9. Establish a trustworthy data model that can later support verification, reviews, subscriptions, and additional Cambodian cities.

### 4.2 Business goals

- Build a useful supply of student rentals around major Phnom Penh institutions.
- Reduce the time students spend searching for accommodation.
- Produce qualified student inquiries for landlords.
- Establish a foundation for future landlord subscription plans or promoted listings without requiring monetization in the MVP.

---

## 5. Non-Goals for MVP

The MVP will **not** initially provide:

- online rent payment;
- security-deposit payment;
- lease/e-signature management;
- property management accounting;
- roommate matching;
- rental of commercial properties or land;
- hotel/short-stay booking;
- native iOS/Android applications;
- an open marketplace for all real-estate categories;
- automated legal advice or rental contract generation;
- live GPS tracking of students or landlords.

The system uses real-world map coordinates, but “real-time location” means an interactive map and current location-based searching when the user grants browser permission. It does not mean continuous person tracking.

---

## 6. Target Users

### 6.1 Student / renter

**Primary persona:** A student moving from a Cambodian province to Phnom Penh to attend university or college.

**Needs:**

- identify rentals close to the institution;
- know approximate distance before visiting;
- stay within a monthly budget;
- understand facilities before contacting a landlord;
- compare several options;
- save promising listings;
- see whether a listing is still available;
- contact the landlord easily;
- use a mobile-friendly website because many searches will happen on a phone.

### 6.2 Landlord / property owner

**Needs:**

- create an account;
- create rental property/listing details;
- place the property on a map;
- upload photos;
- describe price, deposit, facilities, rules, and availability;
- receive student inquiries;
- update availability quickly;
- pause or remove an unavailable listing;
- view and manage all listings from a dashboard.

### 6.3 Platform administrator

**Needs:**

- manage institutions;
- review users and landlords;
- moderate listings;
- remove duplicate, misleading, prohibited, or fraudulent content;
- respond to user reports;
- suspend abusive accounts;
- monitor platform activity and health.

---

## 7. Core User Journeys

### 7.1 Visitor understands the product from the landing page

1. Visitor opens the website.
2. The left side of the desktop hero displays the exact Khmer headline: **“ស្វែងរកបន្ទប់ជួលដែលអ្នកពេញចិត្ត​ និងនៅជិតអ្នកបំផុត.”**
3. A calm vertical phrase loop reinforces nearby, affordable, and currently available rentals without shifting the page layout.
4. The right side displays a clean 3D Google Maps preview centered on a representative Phnom Penh student area.
5. Available demo rentals use a green marker plus an availability label/icon; unavailable demo rentals use a red marker plus an unavailable label/icon. Color is never the only signal.
6. The visitor can start searching, register, or sign in. On small screens, the content stacks and the search action remains more prominent than the map.

The landing map is a product preview. Actual public search defaults to valid published and available listings; unavailable listings appear only when a user deliberately enables that view or in landlord/admin management contexts.

### 7.2 New account chooses a role

1. After registration, or after sign-in when no product role has been selected, the user is sent to `/onboarding/role`.
2. The user chooses **Student** or **Landlord**. `ADMIN` is never offered as a self-service choice.
3. The server validates and stores the role through a single-use onboarding action.
4. A student continues to institution-centered, free rental discovery.
5. A landlord completes a basic profile and starts a seven-day trial when landlord onboarding is successfully activated.
6. Returning users with a completed role skip this step and go to the correct product area.

### 7.3 Student finds a rental near a university

1. Student opens the website.
2. Student searches for/selects their university, college, or school.
3. System centers results around that institution.
4. Student sets filters such as price, distance, property type, and amenities.
5. System shows matching listings in a list and on a map.
6. Student opens a listing.
7. Student reviews photos, monthly price, deposit, distance, location, amenities, description, house rules, and availability.
8. Student saves the listing or sends an inquiry to the landlord.

### 7.4 Student searches from current location

1. Student selects “Use my location.”
2. Browser requests location permission.
3. If approved, the location is used only to calculate/search nearby rentals for the current session or as allowed by the privacy policy.
4. System shows nearby available rentals.
5. Student can still select a specific institution as the destination/reference point.

### 7.5 Landlord creates a listing

1. Landlord creates an account and completes profile information.
2. Landlord opens the landlord dashboard.
3. Landlord selects “Add listing.”
4. Landlord enters rental type, title, description, monthly price, deposit, facilities, availability, and house rules.
5. Landlord searches the address or moves a Google Maps marker to the correct property location.
6. Landlord uploads photos.
7. Landlord previews the listing.
8. Landlord submits/publishes it according to moderation rules.
9. Students can discover it after it is approved/published.

### 7.6 Landlord handles an inquiry

1. Student submits an inquiry from a listing.
2. System records the inquiry and notifies the landlord through the supported notification channel.
3. Landlord views the inquiry in the dashboard.
4. Landlord responds using permitted contact details/workflow.
5. Landlord can mark a unit/listing unavailable when rented.

### 7.7 Admin moderates a listing

1. New or reported listing enters the moderation queue when required.
2. Admin reviews content, coordinates, photos, landlord information, and reports.
3. Admin approves, rejects, requests correction, pauses, or removes the listing.
4. Action is recorded in an audit log.

---

## 8. Functional Requirements

Priority definitions:

- **P0:** Required for MVP launch.
- **P1:** Important shortly after MVP or if schedule permits.
- **P2:** Future enhancement.

### 8.1 Authentication and accounts

| ID | Requirement | Priority |
|---|---|---|
| AUTH-01 | Users can register and sign in securely. | P0 |
| AUTH-02 | Roles include `STUDENT`, `LANDLORD`, and `ADMIN`. | P0 |
| AUTH-03 | Users can sign out from the current session. | P0 |
| AUTH-04 | Users can request a password reset if password authentication is used. | P0 |
| AUTH-05 | Protected actions require authentication. | P0 |
| AUTH-06 | Server enforces authorization; UI-only role restrictions are not sufficient. | P0 |
| AUTH-07 | Users can manage basic profile data. | P0 |
| AUTH-08 | Optional email/phone verification can be added to increase trust. | P1 |
| AUTH-09 | A new user without a product role must choose `STUDENT` or `LANDLORD` during one-time onboarding. | P0 |
| AUTH-10 | `ADMIN` cannot be selected or submitted through self-service onboarding. | P0 |
| AUTH-11 | The backend, not the client, is authoritative for role assignment and onboarding completion. | P0 |
| AUTH-12 | Returning users with completed onboarding are routed to their role-appropriate area. | P0 |

### 8.2 Educational institutions

| ID | Requirement | Priority |
|---|---|---|
| INST-01 | System stores schools, universities, and colleges as institutions. | P0 |
| INST-02 | Each institution stores a name, type, address, latitude, and longitude. | P0 |
| INST-03 | Students can search/select an institution by name. | P0 |
| INST-04 | Admin can create, edit, activate, or deactivate institutions. | P0 |
| INST-05 | Search supports Khmer and English institution names where available. | P1 |

### 8.3 Rental listings

| ID | Requirement | Priority |
|---|---|---|
| LIST-01 | Landlord can create a rental listing. | P0 |
| LIST-02 | Listing includes title, description, property type, monthly price, currency, deposit information, availability, address, coordinates, and contact/inquiry settings. | P0 |
| LIST-03 | Supported initial property types include `ROOM`, `STUDIO`, `APARTMENT`, `HOUSE`, `DORM_ROOM`, and `OTHER_STUDENT_RENTAL`. | P0 |
| LIST-04 | Landlord can add amenities/facilities. | P0 |
| LIST-05 | Landlord can upload and order listing photos. | P0 |
| LIST-06 | Landlord can edit only listings they own unless an admin acts. | P0 |
| LIST-07 | Landlord can set listing status to draft, submitted/pending, published, paused, rented/unavailable, or archived. | P0 |
| LIST-08 | Public search returns only valid published listings. | P0 |
| LIST-09 | Listing shows last-updated/availability information. | P0 |
| LIST-10 | Landlord can duplicate a listing as a starting point for another unit. | P2 |
| LIST-11 | A landlord can record total room/unit count and currently available room/unit count for a property or offer. | P0 |
| LIST-12 | Available count must be between zero and total count; a zero count prevents the offer from appearing as available in default student search. | P0 |

### 8.4 Maps and location

| ID | Requirement | Priority |
|---|---|---|
| MAP-01 | Search page displays listings on Google Maps. | P0 |
| MAP-02 | Clicking a map marker identifies/opens the corresponding listing. | P0 |
| MAP-03 | Landlord can choose location using address/place search and a draggable marker. | P0 |
| MAP-04 | System stores latitude and longitude in PostgreSQL. | P0 |
| MAP-05 | System can calculate distance between a listing and selected institution. | P0 |
| MAP-06 | Student can filter by maximum radius from an institution. | P0 |
| MAP-07 | Map search responds to viewport/bounding-box changes without reloading the full page. | P0 |
| MAP-08 | Student may use browser current location only after explicit permission. | P1 |
| MAP-09 | Walking/driving travel time may be shown using Google Routes where cost and quota permit. | P1 |
| MAP-10 | The desktop landing hero provides a clean 3D Google Maps rental preview with restrained camera/marker motion. | P0 |
| MAP-11 | The student search experience may use a 3D map on capable devices, while preserving synchronized rental cards and a usable 2D fallback. | P0 |
| MAP-12 | Available and unavailable marker states use text/icon/shape as well as green/red color. | P0 |
| MAP-13 | Reduced-motion, low-power, unsupported, slow-network, or map-error states use a static/2D/list fallback without blocking discovery. | P0 |

### 8.5 Search and filters

| ID | Requirement | Priority |
|---|---|---|
| SRCH-01 | Search can start from an institution. | P0 |
| SRCH-02 | Filter by minimum/maximum monthly price. | P0 |
| SRCH-03 | Filter by maximum distance from selected institution. | P0 |
| SRCH-04 | Filter by property type. | P0 |
| SRCH-05 | Filter by selected amenities. | P0 |
| SRCH-06 | Filter by availability. | P0 |
| SRCH-07 | Sort by distance, price low-to-high, price high-to-low, and newest. | P0 |
| SRCH-08 | Search URL preserves useful filters so results can be shared/bookmarked. | P1 |
| SRCH-09 | Results support pagination or cursor-based loading. | P0 |
| SRCH-10 | Empty states explain how to broaden a search. | P0 |

### 8.6 Favorites

| ID | Requirement | Priority |
|---|---|---|
| FAV-01 | Signed-in students can save a listing. | P0 |
| FAV-02 | Students can remove a saved listing. | P0 |
| FAV-03 | Students can view all saved listings. | P0 |
| FAV-04 | Favorite operation is idempotent and prevents duplicates. | P0 |

### 8.7 Inquiries and contact

| ID | Requirement | Priority |
|---|---|---|
| INQ-01 | Signed-in student can send an inquiry about a published listing. | P0 |
| INQ-02 | Inquiry records student, listing, landlord, message, status, and timestamps. | P0 |
| INQ-03 | Landlord can view inquiries related to their listings. | P0 |
| INQ-04 | Student can view inquiries they sent. | P1 |
| INQ-05 | Rate limits prevent inquiry spam. | P0 |
| INQ-06 | Public listing pages should not expose private user data unnecessarily. | P0 |
| INQ-07 | Email/SMS/Telegram notifications can be introduced after the core in-app workflow. | P1 |

### 8.8 Landlord dashboard

| ID | Requirement | Priority |
|---|---|---|
| LND-01 | Dashboard shows landlord-owned listings and statuses. | P0 |
| LND-02 | Landlord can create, edit, pause, archive, and mark listings rented/unavailable. | P0 |
| LND-03 | Dashboard shows recent inquiries. | P0 |
| LND-04 | Basic listing views/inquiry counts are available. | P1 |
| LND-05 | Landlord verification state is visible. | P1 |
| LND-06 | Dashboard displays total and currently available rooms/units and allows the landlord to update availability. | P0 |
| LND-07 | Dashboard displays the landlord trial state and exact end date. | P0 |

### 8.9 Landlord trial and entitlements

| ID | Requirement | Priority |
|---|---|---|
| ENT-01 | Student search, favorites, and inquiries are free. | P0 |
| ENT-02 | A landlord receives one seven-day trial when landlord onboarding is first activated. | P0 |
| ENT-03 | Trial start/end timestamps and state are computed and enforced by the backend; client time is not trusted. | P0 |
| ENT-04 | The MVP trial does not require a payment card. | P0 |
| ENT-05 | During the trial, the landlord can create, submit, publish, and manage listings subject to moderation. | P0 |
| ENT-06 | When the trial expires, landlord data and inquiries remain readable, but new listing creation/publication and availability-expanding actions are blocked; trial listings are paused until an admin-granted extension or future paid entitlement activates them. | P0 |
| ENT-07 | Trial extension or entitlement override is an audited admin action. | P1 |
| ENT-08 | Paid checkout, recurring billing, invoices, and automatic payment collection are outside the course MVP unless approved as a separate scope. | P1 |

### 8.10 Admin and moderation

| ID | Requirement | Priority |
|---|---|---|
| ADM-01 | Admin dashboard is protected by the `ADMIN` role. | P0 |
| ADM-02 | Admin can review and moderate listings. | P0 |
| ADM-03 | Admin can suspend/reactivate users. | P0 |
| ADM-04 | Users can report a suspicious or inaccurate listing. | P0 |
| ADM-05 | Admin can process reports. | P0 |
| ADM-06 | Sensitive admin actions are recorded in an audit log. | P0 |
| ADM-07 | Admin can manage institutions and amenities. | P0 |

### 8.11 Localization and currency

| ID | Requirement | Priority |
|---|---|---|
| LOC-01 | Data model supports Khmer and English text where needed. | P1 |
| LOC-02 | UI architecture is localization-ready from the beginning. | P0 |
| LOC-03 | Rental price stores currency explicitly. | P0 |
| LOC-04 | MVP supports USD and KHR display/storage rules. | P0 |

---

## 9. MVP Screens / Routes

### Public/student-facing

- `/` — landing page with Khmer hero, looping supporting phrase, and 3D rental-map preview
- `/search` — list + map rental search
- `/rentals/[slug]` — rental details
- `/institutions/[slug]` — institution-centered rental discovery (P1)
- `/login`
- `/register`
- `/forgot-password`

### Role onboarding

- `/onboarding/role` — choose Student or Landlord after authentication
- `/onboarding/landlord` — complete landlord profile and activate the seven-day trial

### Student authenticated

- `/favorites`
- `/inquiries`
- `/profile`

### Landlord authenticated

- `/landlord`
- `/landlord/listings`
- `/landlord/listings/new`
- `/landlord/listings/[id]/edit`
- `/landlord/inquiries`
- `/landlord/profile`
- `/landlord/trial` — trial/entitlement status and next action

### Admin

- `/admin`
- `/admin/listings`
- `/admin/users`
- `/admin/reports`
- `/admin/institutions`
- `/admin/amenities`

---

## 10. Listing Data Requirements

A public listing should support at least:

- listing ID;
- SEO-friendly slug;
- landlord ID;
- title;
- description;
- property type;
- monthly price;
- currency;
- deposit amount or deposit notes;
- utility notes;
- address text;
- district/khan and commune/sangkat when known;
- latitude;
- longitude;
- map place ID when available;
- available-from date;
- availability/status;
- room/unit information;
- bedroom/bathroom counts where relevant;
- furnished state;
- amenities;
- house rules;
- photos;
- created date;
- updated date;
- last availability confirmation date;
- moderation status;
- view/inquiry counters where implemented.

---

## 11. Recommended Initial Amenities

The admin should manage amenities so the list can grow without a code change. Initial examples:

- Wi-Fi/internet;
- air conditioning;
- fan;
- private bathroom;
- shared bathroom;
- furnished;
- bed;
- desk/study table;
- kitchen;
- refrigerator;
- washing machine/laundry access;
- parking for motorbike;
- car parking;
- security guard;
- CCTV in common areas;
- gated access;
- water included;
- electricity billing information;
- balcony;
- elevator;
- pet policy.

---

## 12. Search Ranking for MVP

Default ranking should prioritize student usefulness rather than paid placement.

Recommended initial ranking inputs:

1. published and available status;
2. distance to selected institution;
3. freshness/last availability confirmation;
4. completeness of listing information;
5. moderation/verification quality;
6. price only when the user explicitly sorts by price.

Future sponsored listings must be visibly labeled and must not silently override relevance.

---

## 13. Trust and Safety Requirements

1. Students can report inaccurate, duplicated, unavailable, suspicious, or inappropriate listings.
2. Admin can remove content and suspend users.
3. A landlord cannot modify another landlord’s listing.
4. Public APIs must never return password hashes, refresh-token hashes, internal moderation notes, or unnecessary private contact information.
5. Uploaded images must be validated for file type and size.
6. User-generated text must be treated as untrusted input.
7. Listing status and owner authorization are checked server-side for every protected mutation.
8. Exact browser geolocation is never collected before permission is granted.
9. Do not implement continuous background location tracking.
10. The product must clearly distinguish platform information from claims made by landlords.
11. Verification badges, if introduced, must correspond to a real verification process and not be decorative.

---

## 14. Non-Functional Requirements

### 14.1 Performance

- Public pages should be mobile-first and fast on typical Cambodian mobile connections.
- Search API target: p95 under 700 ms for normal cached/optimized searches, excluding third-party map/route latency.
- Listing details API target: p95 under 500 ms under normal operating load.
- Images must use responsive sizes and optimization.
- Map queries must use geographic/bounding-box indexes, not load every property into the browser.
- The landing page must reserve stable map/hero dimensions and must not delay the headline or primary action while 3D assets initialize.
- The 3D map and custom markers must load only within a defined marker/performance budget; lower-capability devices receive the fallback experience.

### 14.2 Availability and resilience

- Stateless web/API containers where practical.
- Redis is optional for correctness; temporary Redis failure must not corrupt core PostgreSQL data.
- Third-party Google Maps failure should degrade gracefully: listing text/details remain usable even if a map cannot load.

### 14.3 Security

- TLS/HTTPS in production.
- Password hashing with a modern password-hashing algorithm such as Argon2id.
- Short-lived access tokens and securely handled refresh sessions if JWT is used.
- HTTP-only, secure cookies for refresh/session secrets where applicable.
- CSRF protection appropriate to the selected auth pattern.
- API rate limiting using Redis.
- Request validation for every write endpoint.
- Role-based access control on the API.
- Secure headers and a Content Security Policy appropriate for Google Maps integrations.
- Secrets are environment variables/secrets-manager values and never committed to Git.

### 14.4 Privacy

- Collect only data required for the product.
- Clearly state how student and landlord personal data is used.
- Do not expose student inquiry history publicly.
- Do not store browser current location unless a documented product requirement later requires it.
- Allow users to update or delete account data subject to platform/legal retention needs.

### 14.5 Accessibility

- Keyboard-accessible navigation and forms.
- Semantic HTML and labels.
- Adequate contrast.
- Visible focus states.
- Map search must also have a list-based alternative so the experience is not map-only.
- The vertical phrase loop must expose a stable accessible sentence, avoid repetitive screen-reader announcements, stop changing under `prefers-reduced-motion`, and provide a pause mechanism when required by the final timing.
- Availability cannot be conveyed through red/green color alone.

### 14.6 SEO

- Published listing pages should provide meaningful metadata.
- Draft, pending, removed, archived, and private dashboard pages should not be indexed.
- Use stable slugs while listing IDs remain authoritative internally.

---

## 15. Analytics and Success Metrics

### Student metrics

- searches started by institution;
- search-to-listing-detail click-through rate;
- favorites per active student;
- inquiries per search session;
- median time from first search to first inquiry;
- zero-result search rate;
- percentage of searches using a university/college as origin.

### Landlord metrics

- landlord role-onboarding completion rate;
- percentage of trials that create a complete listing;
- percentage of trials that reach a published listing;
- expired-trial restriction events;
- listings created;
- listing publish completion rate;
- active listings;
- inquiries per active listing;
- percentage of listings with complete photos/location/amenities;
- average time since availability was last confirmed.

### Platform quality metrics

- number/rate of reported listings;
- stale/unavailable listing rate;
- moderation turnaround;
- duplicate listing rate;
- API error rate;
- search latency.

### MVP success hypothesis

The MVP is valuable if students can consistently discover relevant rentals around selected institutions and landlords receive qualified inquiries without requiring students to rely primarily on scattered social media posts or physical searching.

---

## 16. Access Model and Future Monetization

Student access is free for the MVP. Landlords receive a single seven-day, no-card trial governed by the entitlement requirements above. The course MVP demonstrates trial enforcement and expiry behavior but does not process payments.

Possible future revenue models after pricing, Cambodian payment options, tax/invoicing, and support policies are separately validated:

- landlord subscription tiers;
- monthly quota of active listings;
- promoted listings clearly labeled as sponsored;
- verified landlord/business plans;
- analytics for larger dormitory/property operators.

Free discovery for students remains a core principle unless product strategy changes deliberately.

---

## 17. MVP Release Phases

### Phase 0 — Foundation

- monorepo/repository structure;
- environments and Docker development setup;
- database schema/migrations;
- authentication and roles;
- one-time role onboarding and landlord entitlement model;
- institution seed data;
- Google Maps project/API setup;
- CI checks.

### Phase 1 — Rental supply

- landlord dashboard;
- property/listing CRUD;
- map picker;
- photo uploads;
- amenities;
- moderation/publishing;
- seven-day landlord trial enforcement and expiry behavior.

### Phase 2 — Student discovery

- institution search;
- rental search API;
- map/list UI;
- 3D landing/search enhancement with 2D/list and reduced-motion fallbacks;
- distance filters;
- listing detail page;
- mobile responsiveness.

### Phase 3 — Engagement and safety

- favorites;
- inquiries;
- reports;
- admin moderation tools;
- rate limits;
- basic analytics events.

### Phase 4 — Quality hardening

- testing;
- performance/index tuning;
- stale-listing controls;
- accessibility review;
- security review;
- production monitoring.

---

## 18. MVP Acceptance Criteria

The MVP is ready for launch only when all of the following are true:

- A student can choose an institution and see published rentals near it.
- The landing page presents the exact approved Khmer headline, a stable accessible phrase loop, and a map preview with a working 2D/list fallback.
- Available and unavailable preview markers are distinguishable without relying on color alone.
- A newly authenticated user can choose only Student or Landlord; the API rejects self-service `ADMIN` assignment.
- A returning user with a completed role does not repeat role onboarding.
- Student discovery remains free.
- A new landlord receives exactly one server-timed seven-day trial starting at successful landlord onboarding.
- After trial expiry, landlord data remains intact while restricted publishing actions are rejected and trial listings are paused according to policy.
- Distance filtering returns correct results using stored coordinates.
- A student can switch between/use synchronized map and list results.
- A student can filter by price, distance, property type, amenities, and availability.
- A student can open a complete rental-detail page.
- A signed-in student can favorite/unfavorite a listing.
- A signed-in student can send a valid inquiry.
- A landlord can create a complete listing, choose its location on Google Maps, upload photos, edit it, and change availability.
- A landlord can record total rooms/units and update the currently available count within valid bounds.
- A landlord cannot edit another landlord’s listing.
- An admin can moderate listings and manage reports.
- Draft, paused, rejected, archived, and unavailable listings obey the defined public-visibility rules.
- API payloads are validated and unauthorized actions are rejected.
- Search uses database-side geographic filtering/indexing and does not download all coordinates for client filtering.
- Google Maps keys are restricted appropriately for client/server use.
- Basic mobile, accessibility, performance, error-state, and security checks pass.

---

## 19. Future Opportunities

After the student-focused Phnom Penh MVP proves useful:

- expand to other Cambodian cities and provinces;
- institution-specific landing pages;
- verified landlord/property program;
- student reviews after stronger anti-abuse controls;
- roommate matching;
- scheduled viewing requests;
- transport/travel-time comparisons;
- personalized recommendations;
- stale listing auto-expiration/renewal;
- richer landlord analytics;
- native applications if usage justifies them;
- broader rental categories only if doing so does not weaken the student-first experience.

---

## 20. Product Principles

1. **Start from the student’s institution, not from the general property market.**
2. **Make distance and affordability immediately understandable.**
3. **Prefer accurate, current listings over a large amount of stale inventory.**
4. **Mobile usability is mandatory.**
5. **Trust must come from real moderation and verification, not decorative UI.**
6. **Do not collect location or personal data that the product does not need.**
7. **Keep the MVP focused enough to ship and learn from real Cambodian students and landlords.**
