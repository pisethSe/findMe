import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { argon2id, hash } from "argon2";
import { config as loadEnvironment } from "dotenv";
import pg from "pg";

import { PrismaService } from "../dist/database/prisma.service.js";
import { DiscoveryRepository } from "../dist/modules/discovery/discovery.repository.js";

loadEnvironment({
  path: new URL("../../.env", import.meta.url).pathname,
  quiet: true,
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test(
  "admin moderation publishes only ready listings into PostGIS search and audits decisions",
  { skip: !testDatabaseUrl, timeout: 35_000 },
  async () => {
    const port = 32_180;
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;
    const password = "publication-password-123";
    const landlordEmail = `publication-owner-${randomUUID()}@example.test`;
    const adminEmail = `publication-admin-${randomUUID()}@example.test`;
    const institutionId = randomUUID();
    const institutionSlug = `publication-school-${randomUUID()}`;
    const inactiveInstitutionId = randomUUID();
    const inactiveInstitutionSlug = `inactive-publication-school-${randomUUID()}`;
    const inactiveInstitutionName = `Inactive Publication School ${randomUUID()}`;
    const sharedAmenityId = randomUUID();
    const exactAmenityId = randomUUID();
    const sharedAmenityKey = `search-shared-${randomUUID()}`;
    const exactAmenityKey = `search-exact-${randomUUID()}`;
    const server = spawn(process.execPath, ["dist/main.js"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        APP_ENV: "test",
        PORT: String(port),
        WEB_ORIGIN: "http://localhost:3000",
        DATABASE_URL: testDatabaseUrl,
        REDIS_URL: "",
        JWT_ACCESS_SECRET: "publication-access-secret-is-long-and-unique",
        REFRESH_TOKEN_SECRET:
          "publication-refresh-secret-is-also-long-and-unique",
        JWT_ACCESS_TTL: "15m",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let serverOutput = "";
    server.stdout.on("data", (chunk) => {
      serverOutput += String(chunk);
    });
    server.stderr.on("data", (chunk) => {
      serverOutput += String(chunk);
    });

    const database = new pg.Client({ connectionString: testDatabaseUrl });
    await database.connect();

    try {
      await waitForServer(`${baseUrl}/health/live`, server, () => serverOutput);
      await database.query(
        `INSERT INTO institutions (
           id, slug, name_km, name_en, short_name, type, latitude, longitude
         ) VALUES ($1, $2, 'សាលាសាកល្បង', 'Publication Test School', 'PTS',
                   'university', 11.568300, 104.890700)`,
        [institutionId, institutionSlug],
      );
      await database.query(
        `INSERT INTO institutions (
           id, slug, name_km, name_en, short_name, type, latitude, longitude,
           is_active
         ) VALUES ($1, $2, 'សាលាអសកម្ម', $3, 'IPTS', 'college',
                   11.568400, 104.890800, false)`,
        [
          inactiveInstitutionId,
          inactiveInstitutionSlug,
          inactiveInstitutionName,
        ],
      );
      await database.query(
        `INSERT INTO amenities (id, key, name_km, name_en, is_active, sort_order)
         VALUES
           ($1, $2, 'គ្រឿងបរិក្ខារសាកល្បង', 'Shared search amenity', true, 900),
           ($3, $4, 'គ្រឿងបរិក្ខារជាក់លាក់', 'Exact search amenity', true, 901)`,
        [sharedAmenityId, sharedAmenityKey, exactAmenityId, exactAmenityKey],
      );
      const adminPasswordHash = await hash(password, {
        type: argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      });
      await database.query(
        `INSERT INTO users (
           email, password_hash, role, preferred_locale, onboarding_completed_at
         ) VALUES ($1, $2, 'admin', 'en', CURRENT_TIMESTAMP)`,
        [adminEmail, adminPasswordHash],
      );

      const adminSession = await api(baseUrl, "POST", "/auth/login", {
        body: { email: adminEmail, password },
      });
      assert.equal(adminSession.response.status, 200);
      const adminHeaders = bearer(adminSession.body.data.accessToken);
      const landlordSession = await register(baseUrl, landlordEmail, password);
      const landlordHeaders = bearer(landlordSession.body.data.accessToken);
      await activateLandlord(baseUrl, landlordHeaders);

      const selectedInstitution = await api(
        baseUrl,
        "GET",
        `/institutions?slug=${institutionSlug}&limit=1`,
      );
      assert.equal(selectedInstitution.response.status, 200);
      assert.equal(selectedInstitution.body.data[0].id, institutionId);
      assert.equal(selectedInstitution.body.meta.selectedSlug, institutionSlug);

      const englishInstitutions = await api(
        baseUrl,
        "GET",
        "/institutions?query=publication%20test&limit=10",
      );
      assert.equal(englishInstitutions.response.status, 200);
      assert.equal(
        englishInstitutions.body.data.some((item) => item.id === institutionId),
        true,
      );

      const khmerInstitutions = await api(
        baseUrl,
        "GET",
        `/institutions?query=${encodeURIComponent("សាលាសាកល្បង")}&limit=10`,
      );
      assert.equal(khmerInstitutions.response.status, 200);
      assert.equal(
        khmerInstitutions.body.data.some((item) => item.id === institutionId),
        true,
      );

      const inactiveInstitutions = await api(
        baseUrl,
        "GET",
        `/institutions?query=${encodeURIComponent(inactiveInstitutionName)}`,
      );
      assert.equal(inactiveInstitutions.response.status, 200);
      assert.equal(inactiveInstitutions.body.meta.count, 0);

      const conflictingInstitutionSearch = await api(
        baseUrl,
        "GET",
        `/institutions?query=publication&slug=${institutionSlug}`,
      );
      assert.equal(conflictingInstitutionSearch.response.status, 400);
      assert.equal(
        conflictingInstitutionSearch.body.error.code,
        "INSTITUTION_SEARCH_CONFLICT",
      );

      const invalidInstitutionSearch = await api(
        baseUrl,
        "GET",
        `/institutions?query=${"x".repeat(101)}`,
      );
      assert.equal(invalidInstitutionSearch.response.status, 400);
      assert.equal(
        invalidInstitutionSearch.body.error.code,
        "VALIDATION_FAILED",
      );

      const created = await api(baseUrl, "POST", "/landlord/listings", {
        headers: landlordHeaders,
        body: listingInput("Publishable room"),
      });
      assert.equal(created.response.status, 201);
      const listingId = created.body.data.id;
      await addReadyPhoto(database, listingId);
      await addAmenities(database, listingId, [
        sharedAmenityId,
        exactAmenityId,
      ]);
      const submitted = await api(
        baseUrl,
        "POST",
        `/landlord/listings/${listingId}/submit`,
        { headers: landlordHeaders, body: {} },
      );
      assert.equal(submitted.response.status, 200);
      assert.equal(submitted.body.data.status, "PENDING_REVIEW");

      const searchPath = `/listings/search?institutionId=${institutionId}&radiusMeters=1000&maxPrice=150&currency=USD&propertyType=ROOM`;
      process.env.DATABASE_URL = testDatabaseUrl;
      const directPrisma = new PrismaService();
      const directSearch = await new DiscoveryRepository(directPrisma).search({
        institutionId,
        radiusMeters: 1_000,
        maxPrice: 150,
        currency: "USD",
        propertyTypes: ["ROOM"],
        amenities: [],
        availableBy: "2099-12-31",
        viewport: null,
        sort: "distance",
        page: 1,
        pageSize: 20,
      });
      await directPrisma.$disconnect();
      assert.equal(
        directSearch.records.some((item) => item.id === listingId),
        false,
      );
      const hiddenBeforeApproval = await api(baseUrl, "GET", searchPath);
      assert.equal(hiddenBeforeApproval.response.status, 200);
      assert.equal(
        hiddenBeforeApproval.body.data.some((item) => item.id === listingId),
        false,
      );

      const unauthenticatedQueue = await api(
        baseUrl,
        "GET",
        "/admin/listings/pending",
      );
      assert.equal(unauthenticatedQueue.response.status, 401);
      const landlordQueue = await api(
        baseUrl,
        "GET",
        "/admin/listings/pending",
        { headers: landlordHeaders },
      );
      assert.equal(landlordQueue.response.status, 403);
      assert.equal(landlordQueue.body.error.code, "ROLE_FORBIDDEN");

      const queue = await api(
        baseUrl,
        "GET",
        "/admin/listings/pending?page=1&pageSize=50",
        { headers: adminHeaders },
      );
      assert.equal(queue.response.status, 200);
      const pending = queue.body.data.find((item) => item.id === listingId);
      assert.equal(pending.landlord.displayName, "Publication Owner");
      assert.equal(pending.images[0].status, "READY");

      const approved = await api(
        baseUrl,
        "POST",
        `/admin/listings/${listingId}/approve`,
        { headers: adminHeaders, body: {} },
      );
      assert.equal(approved.response.status, 200);
      assert.equal(approved.body.data.status, "PUBLISHED");
      assert.equal(typeof approved.body.data.publishedAt, "string");

      const visibleAfterApproval = await api(baseUrl, "GET", searchPath);
      assert.equal(visibleAfterApproval.response.status, 200);
      const publicListing = visibleAfterApproval.body.data.find(
        (item) => item.id === listingId,
      );
      assert.ok(publicListing);
      assert.equal(publicListing.primaryImage.publicUrl.includes("cdn"), true);
      assert.equal(publicListing.distanceMeters < 1_000, true);
      assert.equal("moderationNote" in publicListing, false);
      assert.equal("landlordId" in publicListing, false);
      assert.equal("addressLine" in publicListing.location, false);

      const currencyAmbiguous = await api(
        baseUrl,
        "GET",
        `/listings/search?institutionId=${institutionId}&radiusMeters=1000&maxPrice=150`,
      );
      assert.equal(currencyAmbiguous.response.status, 400);
      assert.equal(
        currencyAmbiguous.body.error.code,
        "SEARCH_CURRENCY_REQUIRED",
      );

      const farther = await api(baseUrl, "POST", "/landlord/listings", {
        headers: landlordHeaders,
        body: listingInput("Farther publishable apartment", 11.574, 104.8907, {
          propertyType: "APARTMENT",
          monthlyPrice: 125,
        }),
      });
      assert.equal(farther.response.status, 201);
      const fartherListingId = farther.body.data.id;
      await addReadyPhoto(database, fartherListingId);
      await addAmenities(database, fartherListingId, [sharedAmenityId]);
      await api(
        baseUrl,
        "POST",
        `/landlord/listings/${fartherListingId}/submit`,
        { headers: landlordHeaders, body: {} },
      );
      const fartherApproval = await api(
        baseUrl,
        "POST",
        `/admin/listings/${fartherListingId}/approve`,
        { headers: adminHeaders, body: {} },
      );
      assert.equal(fartherApproval.response.status, 200);

      const future = await api(baseUrl, "POST", "/landlord/listings", {
        headers: landlordHeaders,
        body: listingInput("Future studio", 11.57, 104.8907, {
          propertyType: "STUDIO",
          monthlyPrice: 110,
          availableFrom: "2099-01-01",
        }),
      });
      assert.equal(future.response.status, 201);
      const futureListingId = future.body.data.id;
      await addReadyPhoto(database, futureListingId);
      await addAmenities(database, futureListingId, [sharedAmenityId]);
      await api(
        baseUrl,
        "POST",
        `/landlord/listings/${futureListingId}/submit`,
        { headers: landlordHeaders, body: {} },
      );
      const futureApproval = await api(
        baseUrl,
        "POST",
        `/admin/listings/${futureListingId}/approve`,
        { headers: adminHeaders, body: {} },
      );
      assert.equal(futureApproval.response.status, 200);

      const comparisonPath = `/listings/search?institutionId=${institutionId}&radiusMeters=1000&amenities=${sharedAmenityKey}`;
      const distanceSorted = await api(baseUrl, "GET", comparisonPath);
      const orderedMatchingIds = distanceSorted.body.data.map(
        (item) => item.id,
      );
      assert.deepEqual(orderedMatchingIds, [listingId, fartherListingId]);
      assert.equal(distanceSorted.body.meta.total, 2);
      assert.deepEqual(distanceSorted.body.meta.filters.amenities, [
        sharedAmenityKey,
      ]);
      assert.match(
        distanceSorted.body.meta.filters.availableBy,
        /^\d{4}-\d{2}-\d{2}$/,
      );

      const availableByFuture = await api(
        baseUrl,
        "GET",
        `${comparisonPath}&availableBy=2099-01-01`,
      );
      assert.deepEqual(
        availableByFuture.body.data.map((item) => item.id),
        [listingId, futureListingId, fartherListingId],
      );
      assert.equal(
        availableByFuture.body.data.find((item) => item.id === futureListingId)
          .availableFrom,
        "2099-01-01",
      );
      assert.equal(
        availableByFuture.body.meta.filters.availableBy,
        "2099-01-01",
      );

      const exactAmenities = await api(
        baseUrl,
        "GET",
        `/listings/search?institutionId=${institutionId}&radiusMeters=1000&amenities=${sharedAmenityKey},${exactAmenityKey}`,
      );
      assert.deepEqual(
        exactAmenities.body.data.map((item) => item.id),
        [listingId],
      );

      const multiplePropertyTypes = await api(
        baseUrl,
        "GET",
        `/listings/search?institutionId=${institutionId}&radiusMeters=1000&propertyTypes=ROOM,APARTMENT&amenities=${sharedAmenityKey}`,
      );
      assert.deepEqual(
        multiplePropertyTypes.body.data.map((item) => item.id),
        [listingId, fartherListingId],
      );
      assert.deepEqual(multiplePropertyTypes.body.meta.filters.propertyTypes, [
        "APARTMENT",
        "ROOM",
      ]);

      const viewportFiltered = await api(
        baseUrl,
        "GET",
        `${comparisonPath}&north=11.5695&south=11.5685&east=104.891&west=104.890`,
      );
      assert.deepEqual(
        viewportFiltered.body.data.map((item) => item.id),
        [listingId],
      );
      assert.deepEqual(viewportFiltered.body.meta.viewport, {
        north: 11.5695,
        south: 11.5685,
        east: 104.891,
        west: 104.89,
      });

      const priceAscending = await api(
        baseUrl,
        "GET",
        `${comparisonPath}&currency=USD&sort=price_asc`,
      );
      assert.deepEqual(
        priceAscending.body.data.map((item) => item.id),
        [listingId, fartherListingId],
      );
      const priceDescending = await api(
        baseUrl,
        "GET",
        `${comparisonPath}&currency=USD&sort=price_desc`,
      );
      assert.deepEqual(
        priceDescending.body.data.map((item) => item.id),
        [fartherListingId, listingId],
      );

      await database.query(
        `UPDATE listings
         SET published_at = CASE id
           WHEN $1 THEN '2026-01-01T00:00:00.000Z'::timestamptz
           WHEN $2 THEN '2026-02-01T00:00:00.000Z'::timestamptz
           WHEN $3 THEN '2026-03-01T00:00:00.000Z'::timestamptz
         END
         WHERE id = ANY($4::uuid[])`,
        [
          listingId,
          fartherListingId,
          futureListingId,
          [listingId, fartherListingId, futureListingId],
        ],
      );
      const newestFirst = await api(
        baseUrl,
        "GET",
        `${comparisonPath}&availableBy=2099-01-01&sort=newest`,
      );
      assert.deepEqual(
        newestFirst.body.data.map((item) => item.id),
        [futureListingId, fartherListingId, listingId],
      );

      const firstSearchPage = await api(
        baseUrl,
        "GET",
        `${comparisonPath}&page=1&pageSize=1`,
      );
      const secondSearchPage = await api(
        baseUrl,
        "GET",
        `${comparisonPath}&page=2&pageSize=1`,
      );
      assert.equal(firstSearchPage.body.meta.total, 2);
      assert.equal(firstSearchPage.body.meta.totalPages, 2);
      assert.equal(firstSearchPage.body.data[0].id, listingId);
      assert.equal(secondSearchPage.body.data[0].id, fartherListingId);

      const priceFiltered = await api(
        baseUrl,
        "GET",
        `${comparisonPath}&minPrice=100&maxPrice=130&currency=USD`,
      );
      assert.deepEqual(
        priceFiltered.body.data.map((item) => item.id),
        [fartherListingId],
      );

      const incompleteViewport = await api(
        baseUrl,
        "GET",
        `${comparisonPath}&north=11.6`,
      );
      assert.equal(incompleteViewport.response.status, 400);
      assert.equal(
        incompleteViewport.body.error.code,
        "SEARCH_VIEWPORT_INCOMPLETE",
      );

      const invalidAvailableBy = await api(
        baseUrl,
        "GET",
        `${comparisonPath}&availableBy=2026-02-30`,
      );
      assert.equal(invalidAvailableBy.response.status, 400);
      assert.equal(
        invalidAvailableBy.body.error.code,
        "SEARCH_AVAILABLE_BY_INVALID",
      );

      const approvalAudit = await database.query(
        `SELECT action, actor_id, metadata
         FROM audit_logs
         WHERE entity_type = 'Listing' AND entity_id = $1`,
        [listingId],
      );
      assert.equal(approvalAudit.rows[0].action, "LISTING_APPROVED");
      assert.equal(approvalAudit.rows[0].metadata.nextStatus, "PUBLISHED");

      const unavailable = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${listingId}/availability`,
        { headers: landlordHeaders, body: { availableUnits: 0 } },
      );
      assert.equal(unavailable.response.status, 200);
      assert.equal(unavailable.body.data.status, "RENTED");
      const hiddenAfterAvailability = await api(baseUrl, "GET", searchPath);
      assert.equal(
        hiddenAfterAvailability.body.data.some((item) => item.id === listingId),
        false,
      );

      const incomplete = await api(baseUrl, "POST", "/landlord/listings", {
        headers: landlordHeaders,
        body: listingInput("Missing photo"),
      });
      const incompleteId = incomplete.body.data.id;
      await api(baseUrl, "POST", `/landlord/listings/${incompleteId}/submit`, {
        headers: landlordHeaders,
        body: {},
      });
      const incompleteApproval = await api(
        baseUrl,
        "POST",
        `/admin/listings/${incompleteId}/approve`,
        { headers: adminHeaders, body: {} },
      );
      assert.equal(incompleteApproval.response.status, 409);
      assert.equal(
        incompleteApproval.body.error.code,
        "LISTING_NOT_READY_FOR_PUBLICATION",
      );
      const invalidRejection = await api(
        baseUrl,
        "POST",
        `/admin/listings/${incompleteId}/reject`,
        { headers: adminHeaders, body: { moderationNote: " " } },
      );
      assert.equal(invalidRejection.response.status, 400);
      const rejected = await api(
        baseUrl,
        "POST",
        `/admin/listings/${incompleteId}/reject`,
        {
          headers: adminHeaders,
          body: { moderationNote: "Add at least one clear rental photo." },
        },
      );
      assert.equal(rejected.response.status, 200);
      assert.equal(rejected.body.data.status, "REJECTED");
      assert.equal(
        rejected.body.data.moderationNote,
        "Add at least one clear rental photo.",
      );

      const expiring = await api(baseUrl, "POST", "/landlord/listings", {
        headers: landlordHeaders,
        body: listingInput("Expired before approval"),
      });
      const expiringId = expiring.body.data.id;
      await addReadyPhoto(database, expiringId);
      await api(baseUrl, "POST", `/landlord/listings/${expiringId}/submit`, {
        headers: landlordHeaders,
        body: {},
      });
      const landlord = await database.query(
        "SELECT id FROM users WHERE email = $1",
        [landlordEmail],
      );
      await database.query(
        "UPDATE landlord_entitlements SET status = 'expired' WHERE landlord_id = $1",
        [landlord.rows[0].id],
      );
      const expiredApproval = await api(
        baseUrl,
        "POST",
        `/admin/listings/${expiringId}/approve`,
        { headers: adminHeaders, body: {} },
      );
      assert.equal(expiredApproval.response.status, 403);
      assert.equal(
        expiredApproval.body.error.code,
        "LANDLORD_ENTITLEMENT_REQUIRED",
      );
    } finally {
      await database.query(
        `DELETE FROM listings
         WHERE landlord_id IN (SELECT id FROM users WHERE email = $1)`,
        [landlordEmail],
      );
      await database.query(
        `DELETE FROM properties
         WHERE landlord_id IN (SELECT id FROM users WHERE email = $1)`,
        [landlordEmail],
      );
      await database.query("DELETE FROM amenities WHERE id = ANY($1::uuid[])", [
        [sharedAmenityId, exactAmenityId],
      ]);
      await database.query(
        `UPDATE users
         SET account_status = 'deleted', deleted_at = CURRENT_TIMESTAMP
         WHERE email = ANY($1::text[])`,
        [[landlordEmail, adminEmail]],
      );
      await database.query(
        "DELETE FROM institutions WHERE id = ANY($1::uuid[])",
        [[institutionId, inactiveInstitutionId]],
      );
      await database.end();
      if (server.exitCode === null) {
        server.kill("SIGTERM");
        await new Promise((resolve) => server.once("exit", resolve));
      }
    }
  },
);

function listingInput(
  titleEn,
  latitude = 11.569,
  longitude = 104.8907,
  options = {},
) {
  return {
    titleEn,
    descriptionEn: "A quiet room suitable for a university student.",
    propertyType: options.propertyType ?? "ROOM",
    monthlyPrice: options.monthlyPrice ?? 95,
    currency: "USD",
    ...(options.availableFrom ? { availableFrom: options.availableFrom } : {}),
    availableUnits: 2,
    contactPreference: "PHONE",
    property: {
      name: `${titleEn} property`,
      addressLine: "Russian Federation Boulevard, Phnom Penh",
      district: "Toul Kork",
      latitude,
      longitude,
      totalUnits: 3,
    },
  };
}

async function addAmenities(database, listingId, amenityIds) {
  await database.query(
    `INSERT INTO listing_amenities (listing_id, amenity_id)
     SELECT $1, unnest($2::uuid[])`,
    [listingId, amenityIds],
  );
}

async function addReadyPhoto(database, listingId) {
  await database.query(
    `INSERT INTO listing_images (
       listing_id, storage_key, public_url, alt_text_en,
       width, height, sort_order, status
     ) VALUES ($1, $2, $3, 'Rental room photo', 1200, 800, 0, 'ready')`,
    [
      listingId,
      `listings/${listingId}/${randomUUID()}.jpg`,
      `https://cdn.example.test/${listingId}.jpg`,
    ],
  );
}

async function activateLandlord(baseUrl, headers) {
  const role = await api(baseUrl, "POST", "/me/onboarding/role", {
    headers,
    body: { role: "LANDLORD" },
  });
  assert.equal(role.response.status, 200);
  const profile = await api(baseUrl, "POST", "/landlord/onboarding", {
    headers,
    body: {
      displayName: "Publication Owner",
      contactPhone: "012345678",
    },
  });
  assert.equal(profile.response.status, 200);
}

function register(baseUrl, email, password) {
  return api(baseUrl, "POST", "/auth/register", {
    body: { email, password, preferredLocale: "KM" },
  });
}

async function api(baseUrl, method, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  return {
    response,
    body: response.status === 204 ? null : await response.json(),
  };
}

function bearer(accessToken) {
  return { authorization: `Bearer ${accessToken}` };
}

async function waitForServer(url, server, output) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) {
      assert.fail(`API exited before becoming ready:\n${output()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`API did not become ready:\n${output()}`);
}
