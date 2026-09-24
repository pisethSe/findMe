import { randomUUID } from "node:crypto";

// Caller owns a transaction and must roll it back. No fixture enters public data.
export async function seedSearchFixture(client, propertyCount = 10000) {
  const ownerId = randomUUID();
  const institutionId = randomUUID();
  await client.query(
    `INSERT INTO users (id, email, password_hash, role, onboarding_completed_at)
     VALUES ($1, $2, 'unusable-benchmark-password', 'landlord', CURRENT_TIMESTAMP)`,
    [ownerId, `performance-${ownerId}@example.test`],
  );
  await client.query(
    `INSERT INTO institutions (id, slug, name_en, name_km, type, latitude, longitude)
     VALUES ($1, $2, 'Performance school', 'សាលាសាកល្បង', 'university', 11.5683, 104.8908)`,
    [institutionId, `performance-${institutionId}`],
  );
  await client.query(
    `INSERT INTO properties (id, landlord_id, name, address_line, latitude, longitude, total_units)
     SELECT md5($1::text || '-property-' || n)::uuid, $1::uuid, 'Student rooms',
       'Synthetic benchmark address',
       11.45 + (n % 100) * 0.002, 104.78 + (n / 100) * 0.002, 3
     FROM generate_series(1, $2::int) n`,
    [ownerId, propertyCount],
  );
  await client.query(
    `INSERT INTO listings (id, property_id, landlord_id, slug, title_en, description_en,
       property_type, monthly_price, currency, available_units, available_from,
       status, published_at, availability_confirmed_at)
     SELECT md5($1::text || '-listing-' || n || '-' || offer)::uuid,
       md5($1::text || '-property-' || n)::uuid, $1::uuid,
       'performance-' || $1::text || '-' || n || '-' || offer, 'Student room', repeat('Quiet room. ', 20),
       (CASE WHEN n % 3 = 0 THEN 'studio' ELSE 'room' END)::property_type,
       50 + n % 250, (CASE WHEN n % 7 = 0 THEN 'KHR' ELSE 'USD' END)::currency,
       CASE WHEN n % 11 = 0 THEN 0 ELSE 1 END,
       CASE WHEN n % 13 = 0 THEN DATE '2099-01-01' ELSE NULL END,
       (CASE offer WHEN 0 THEN 'published' WHEN 1 THEN 'draft' ELSE 'paused' END)::listing_status,
       CURRENT_TIMESTAMP - (n % 30) * INTERVAL '1 day', CURRENT_TIMESTAMP
     FROM generate_series(1, $2::int) n CROSS JOIN generate_series(0, 2) offer`,
    [ownerId, propertyCount],
  );
  await client.query(
    `INSERT INTO amenities (id, key, name_en, name_km, sort_order)
     SELECT md5($1::text || '-amenity-' || n)::uuid, 'perf-' || $1::text || '-amenity-' || n,
       'Facility ' || n, 'សម្ភារៈ', n FROM generate_series(1, 4) n`,
    [ownerId],
  );
  await client.query(
    `INSERT INTO listing_amenities (listing_id, amenity_id)
     SELECT l.id, md5($1::text || '-amenity-' || n)::uuid
     FROM listings l CROSS JOIN generate_series(1, 4) n WHERE l.landlord_id = $1::uuid`,
    [ownerId],
  );
  await client.query(
    `INSERT INTO listing_images (listing_id, storage_key, public_url, sort_order, status, width, height)
     SELECT l.id, 'performance/' || l.id || '/' || n, 'https://images.example.test/room.jpg',
       n, (CASE WHEN n = 0 THEN 'uploading' ELSE 'ready' END)::image_status, 800, 600
     FROM listings l CROSS JOIN generate_series(0, 2) n WHERE l.landlord_id = $1::uuid`,
    [ownerId],
  );
  for (const table of [
    "users",
    "institutions",
    "properties",
    "listings",
    "listing_images",
    "listing_amenities",
    "amenities",
  ]) {
    // Fixed table names, never request data.
    await client.query(`ANALYZE ${table}`);
  }
  return {
    ownerId,
    institutionId,
    propertyCount,
    listingCount: propertyCount * 3,
    amenityKeys: [1, 2].map((n) => `perf-${ownerId}-amenity-${n}`),
  };
}

export function searchScenarios({ institutionId, amenityKeys }) {
  const base = {
    institutionId,
    radiusMeters: 3000,
    propertyTypes: [],
    amenities: [],
    availableBy: "2026-09-11",
    viewport: null,
    sort: "distance",
    page: 1,
    pageSize: 20,
  };
  return [
    { name: "radius-3km", input: base },
    { name: "radius-20km", input: { ...base, radiusMeters: 20000 } },
    {
      name: "viewport",
      input: {
        ...base,
        viewport: { north: 11.575, south: 11.56, east: 104.9, west: 104.88 },
      },
    },
    {
      name: "price",
      input: { ...base, currency: "USD", maxPrice: 100, sort: "price_asc" },
    },
    { name: "amenities", input: { ...base, amenities: amenityKeys } },
    {
      name: "newest-page-5",
      input: { ...base, radiusMeters: 20000, sort: "newest", page: 5 },
    },
    { name: "empty-page", input: { ...base, page: 10000 } },
  ];
}
