# Phase 4 Step 2: search performance and index tuning

Public discovery now filters and sorts in PostGIS before hydrating the requested
page. A materialized page CTE bounds photo selection and amenity serialization to
at most `pageSize` listings, including after an offset. Exact total counts still
use the same eligibility filters. Distance, price, newest, ID tie-breaks and the
public response contract remain unchanged.

Amenity matching checks each candidate using the existing
`listing_amenities(listing_id, amenity_id)` primary key instead of grouping the
whole marketplace's amenity associations. AND semantics remain exact because
the DTO rejects duplicate keys, amenity keys are unique, and the association
primary key prevents duplicates. Inactive amenities cannot satisfy a filter.

## Index and deployment

Apply `20260911000200_public_search_property_index` before deploying the API:

```bash
corepack pnpm run db:migrate
```

The SQL-managed partial `listings_public_search_property_idx` indexes
`property_id` only for published, non-deleted listings with positive inventory
and required publication/confirmation timestamps. Dynamic availability dates
remain query filters. The existing GiST property-location index handles radius
and viewport queries. The full property index remains for private/ownership
flows. No constraints, data, cache policy or API parameters are changed.

The new index was used by the measured spatial plans and reduced the 20 km
query-pair median from 83.1 ms after query changes alone to 58.5 ms. No additional
price/photo indexes were added without evidence of need.

The migration uses standard `CREATE INDEX`. Schedule a suitable deployment
window because index creation can block writes to `listings`. For a large
deployed table, plan a separate reviewed concurrent-index migration. Preserve
this SQL-managed partial index when generating future Prisma migrations; its
predicate is documented in the migration and referenced in the Prisma schema.
The previous API works with the added index, and the new API remains correct
without it. Reverting the API does not require dropping the index.

## Measured results

Local PostgreSQL 17 / PostGIS 3.5 in Docker, Node 24.18.0, on an ARM Mac running
the amd64 PostGIS image. The disposable fixture has 10,000 properties, 30,000
offers (published/draft/paused), 90,000 image records, and 120,000 amenity links.
It includes unavailable units, future availability, both currencies and tied
sort values. These are synthetic benchmark records, not product statistics.

Each measurement covers the sequential page and exact-count SQL queries with
bound parameters, including local driver/transport time. This comparison uses
ten samples per case after an explanatory query warms the database.

| Search                       | Matches | Before p50 / p95 (ms) | After query + index p50 / p95 (ms) |
| ---------------------------- | ------: | --------------------: | ---------------------------------: |
| 3 km radius                  |     490 |           30.3 / 33.8 |                        10.8 / 13.6 |
| 20 km radius                 |   8,391 |         402.9 / 416.7 |                        58.5 / 63.2 |
| Map viewport within radius   |      66 |           12.1 / 13.5 |                         8.9 / 10.0 |
| USD budget and price sorting |      85 |           14.4 / 18.7 |                         9.9 / 11.4 |
| Two required amenities       |     490 |         120.9 / 125.4 |                        16.3 / 20.9 |
| Newest, fifth page, 20 km    |   8,391 |         394.9 / 480.5 |                        58.4 / 80.5 |
| Offset beyond final page     |     490 |           30.1 / 31.8 |                          8.2 / 9.2 |

`EXPLAIN (ANALYZE, BUFFERS)` showed the original 20 km photo/amenity joins running
8,391 times. After tuning, they run 20 times for a 20-card page. The geographic
GiST and new partial listing index are both used. A subsequent 30-sample run,
with three warmups per case, measured 57.9 / 77.4 ms for the 20 km query pair and
16.0 / 17.6 ms for the amenity case.

These measurements establish local query improvement, not the PRD's production
API SLO. Search API p95 below 700 ms and detail API p95 below 500 ms still need
representative deployed load checks, including pooling, concurrency, API/Redis
work and Neon network latency. Third-party Maps and image delivery are excluded.

## Reproduce and inspect

Start the disposable services described in [Testing](TESTING.md), export their
database variables, and apply migrations. Then run:

```bash
export TEST_DATABASE_URL=postgresql://findme:findme_test@127.0.0.1:55432/findme_test
corepack pnpm run benchmark:search

# Optional full plan artifact; build first if running the script directly.
node backend-part/tests/performance/search-benchmark.mjs /tmp/findme-search-plan.json
```

The command builds the current backend, captures its actual parameterized SQL
at the Prisma boundary, seeds and analyzes a transaction-local dataset, performs
three warmups and 30 samples per case, prints p50/p95, and rolls back all fixture
rows. The optional JSON artifact contains the plans and buffer statistics.
The benchmark accepts only an explicitly supplied loopback PostgreSQL test URL.
Use the disposable stack and avoid simultaneous load tests. Rollback prevents
committed fixture data; it does not eliminate temporary disk/CPU use or dead
tuples awaiting vacuum.

`discovery-performance.integration.test.mjs` runs in the normal database test
gate. It checks page-bounded photo/amenity work, ready-photo selection, exact
totals on empty pages, and consistent pagination/tie ordering on large data.
It checks work bounds instead of flaky elapsed-time thresholds. Existing real
HTTP publication/search/detail tests cover visibility, currency/type/amenity
filters, radius boundaries and public serializers.
