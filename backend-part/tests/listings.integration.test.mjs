import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { config as loadEnvironment } from "dotenv";
import pg from "pg";

loadEnvironment({
  path: new URL("../../.env", import.meta.url).pathname,
  quiet: true,
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test(
  "landlord listing APIs enforce validation, ownership, lifecycle, capacity, and trial access",
  { skip: !testDatabaseUrl, timeout: 30_000 },
  async () => {
    const port = 32_175;
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;
    const password = "listing-password-123";
    const activeEmail = `listing-active-${randomUUID()}@example.test`;
    const otherEmail = `listing-other-${randomUUID()}@example.test`;
    const incompleteEmail = `listing-incomplete-${randomUUID()}@example.test`;
    const expiredEmail = `listing-expired-${randomUUID()}@example.test`;
    const studentEmail = `listing-student-${randomUUID()}@example.test`;
    const amenityId = randomUUID();
    const amenityKey = `listing-test-${randomUUID()}`;
    const server = spawn(process.execPath, ["dist/main.js"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        APP_ENV: "test",
        PORT: String(port),
        WEB_ORIGIN: "http://localhost:3000",
        DATABASE_URL: testDatabaseUrl,
        JWT_ACCESS_SECRET: "integration-access-secret-is-long-and-unique",
        REFRESH_TOKEN_SECRET:
          "integration-refresh-secret-is-also-long-and-unique",
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
        `INSERT INTO amenities (id, key, name_km, name_en, is_active)
         VALUES ($1, $2, 'វ៉ាយហ្វាយសាកល្បង', 'Test Wi-Fi', true)`,
        [amenityId, amenityKey],
      );

      const unauthenticated = await api(baseUrl, "POST", "/landlord/listings", {
        body: validListingInput(amenityId),
      });
      assert.equal(unauthenticated.response.status, 401);
      assert.equal(unauthenticated.body.error.code, "ACCESS_TOKEN_REQUIRED");

      const student = await register(baseUrl, studentEmail, password);
      const studentHeaders = bearer(student.body.data.accessToken);
      await api(baseUrl, "POST", "/me/onboarding/role", {
        headers: studentHeaders,
        body: { role: "STUDENT", displayName: "Student Account" },
      });
      const studentCreate = await api(baseUrl, "POST", "/landlord/listings", {
        headers: studentHeaders,
        body: validListingInput(amenityId),
      });
      assert.equal(studentCreate.response.status, 403);
      assert.equal(studentCreate.body.error.code, "ROLE_FORBIDDEN");

      const incomplete = await register(baseUrl, incompleteEmail, password);
      const incompleteHeaders = bearer(incomplete.body.data.accessToken);
      await api(baseUrl, "POST", "/me/onboarding/role", {
        headers: incompleteHeaders,
        body: { role: "LANDLORD" },
      });
      const incompleteCreate = await api(
        baseUrl,
        "POST",
        "/landlord/listings",
        { headers: incompleteHeaders, body: validListingInput(amenityId) },
      );
      assert.equal(incompleteCreate.response.status, 409);
      assert.equal(
        incompleteCreate.body.error.code,
        "LANDLORD_ONBOARDING_REQUIRED",
      );

      const active = await register(baseUrl, activeEmail, password);
      const activeHeaders = bearer(active.body.data.accessToken);
      await activateLandlord(baseUrl, activeHeaders, "Active Owner");

      const invalidCapacity = await api(baseUrl, "POST", "/landlord/listings", {
        headers: activeHeaders,
        body: validListingInput(amenityId, {
          property: { totalUnits: 1 },
          availableUnits: 2,
        }),
      });
      assert.equal(invalidCapacity.response.status, 400);
      assert.equal(
        invalidCapacity.body.error.code,
        "AVAILABLE_UNITS_EXCEED_TOTAL",
      );

      const invalidAmenity = await api(baseUrl, "POST", "/landlord/listings", {
        headers: activeHeaders,
        body: validListingInput(randomUUID()),
      });
      assert.equal(invalidAmenity.response.status, 400);
      assert.equal(invalidAmenity.body.error.code, "AMENITIES_INVALID");

      const created = await api(baseUrl, "POST", "/landlord/listings", {
        headers: activeHeaders,
        body: validListingInput(amenityId),
      });
      assert.equal(created.response.status, 201);
      assert.equal(created.body.data.status, "DRAFT");
      assert.equal(created.body.data.availableUnits, 2);
      assert.equal(created.body.data.property.totalUnits, 3);
      assert.equal(created.body.data.contactPreference, "PHONE_OR_TELEGRAM");
      assert.equal(created.body.data.amenities[0].id, amenityId);
      assert.equal("moderationNote" in created.body.data, false);
      const listingId = created.body.data.id;

      const storedOwnership = await database.query(
        `SELECT l.landlord_id, p.landlord_id AS property_landlord_id
         FROM listings l
         JOIN properties p ON p.id = l.property_id
         WHERE l.id = $1`,
        [listingId],
      );
      const activeUser = await database.query(
        "SELECT id FROM users WHERE email = $1",
        [activeEmail],
      );
      assert.equal(storedOwnership.rows[0].landlord_id, activeUser.rows[0].id);
      assert.equal(
        storedOwnership.rows[0].property_landlord_id,
        activeUser.rows[0].id,
      );

      const injectedOwner = await api(baseUrl, "POST", "/landlord/listings", {
        headers: activeHeaders,
        body: { ...validListingInput(amenityId), landlordId: randomUUID() },
      });
      assert.equal(injectedOwner.response.status, 400);
      assert.equal(injectedOwner.body.error.code, "VALIDATION_FAILED");

      const list = await api(
        baseUrl,
        "GET",
        "/landlord/listings?page=1&pageSize=10",
        {
          headers: activeHeaders,
        },
      );
      assert.equal(list.response.status, 200);
      assert.equal(list.body.meta.page, 1);
      assert.equal(list.body.meta.total, 1);
      assert.equal(list.body.data[0].id, listingId);

      const other = await register(baseUrl, otherEmail, password);
      const otherHeaders = bearer(other.body.data.accessToken);
      await activateLandlord(baseUrl, otherHeaders, "Other Owner", false);
      const unavailableContactChannel = await api(
        baseUrl,
        "POST",
        "/landlord/listings",
        { headers: otherHeaders, body: validListingInput(amenityId) },
      );
      assert.equal(unavailableContactChannel.response.status, 400);
      assert.equal(
        unavailableContactChannel.body.error.code,
        "CONTACT_PREFERENCE_UNAVAILABLE",
      );
      const otherRead = await api(
        baseUrl,
        "GET",
        `/landlord/listings/${listingId}`,
        { headers: otherHeaders },
      );
      assert.equal(otherRead.response.status, 404);
      assert.equal(otherRead.body.error.code, "LISTING_NOT_FOUND");
      const otherEdit = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${listingId}`,
        { headers: otherHeaders, body: { titleEn: "Stolen listing" } },
      );
      assert.equal(otherEdit.response.status, 404);

      const emptyEdit = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${listingId}`,
        { headers: activeHeaders, body: {} },
      );
      assert.equal(emptyEdit.response.status, 400);
      assert.equal(emptyEdit.body.error.code, "LISTING_UPDATE_EMPTY");

      const blankPropertyName = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${listingId}`,
        { headers: activeHeaders, body: { property: { name: "   " } } },
      );
      assert.equal(blankPropertyName.response.status, 400);
      assert.equal(blankPropertyName.body.error.code, "VALIDATION_FAILED");

      const lowCapacity = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${listingId}`,
        { headers: activeHeaders, body: { property: { totalUnits: 1 } } },
      );
      assert.equal(lowCapacity.response.status, 400);
      assert.equal(lowCapacity.body.error.code, "PROPERTY_CAPACITY_TOO_LOW");

      const updated = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${listingId}`,
        {
          headers: activeHeaders,
          body: {
            titleEn: "Updated student room",
            property: { totalUnits: 4 },
          },
        },
      );
      assert.equal(updated.response.status, 200);
      assert.equal(updated.body.data.titleEn, "Updated student room");
      assert.equal(updated.body.data.property.totalUnits, 4);

      const invalidStatusInjection = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${listingId}`,
        { headers: activeHeaders, body: { status: "PUBLISHED" } },
      );
      assert.equal(invalidStatusInjection.response.status, 400);
      assert.equal(invalidStatusInjection.body.error.code, "VALIDATION_FAILED");

      const excessiveAvailability = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${listingId}/availability`,
        { headers: activeHeaders, body: { availableUnits: 5 } },
      );
      assert.equal(excessiveAvailability.response.status, 400);
      assert.equal(
        excessiveAvailability.body.error.code,
        "AVAILABLE_UNITS_EXCEED_TOTAL",
      );

      const unavailable = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${listingId}/availability`,
        { headers: activeHeaders, body: { availableUnits: 0 } },
      );
      assert.equal(unavailable.response.status, 200);
      assert.equal(unavailable.body.data.availableUnits, 0);
      const unavailableSubmit = await api(
        baseUrl,
        "POST",
        `/landlord/listings/${listingId}/submit`,
        { headers: activeHeaders, body: {} },
      );
      assert.equal(unavailableSubmit.response.status, 409);
      assert.equal(
        unavailableSubmit.body.error.code,
        "LISTING_AVAILABILITY_REQUIRED",
      );

      await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${listingId}/availability`,
        { headers: activeHeaders, body: { availableUnits: 2 } },
      );
      const submitted = await api(
        baseUrl,
        "POST",
        `/landlord/listings/${listingId}/submit`,
        { headers: activeHeaders, body: {} },
      );
      assert.equal(submitted.response.status, 200);
      assert.equal(submitted.body.data.status, "PENDING_REVIEW");
      assert.equal(
        typeof submitted.body.data.availabilityConfirmedAt,
        "string",
      );

      const pendingEdit = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${listingId}`,
        { headers: activeHeaders, body: { titleEn: "Pending edit" } },
      );
      assert.equal(pendingEdit.response.status, 409);
      assert.equal(
        pendingEdit.body.error.code,
        "LISTING_STATE_TRANSITION_INVALID",
      );

      await database.query(
        `UPDATE listings
         SET status = 'published', published_at = CURRENT_TIMESTAMP,
             availability_confirmed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [listingId],
      );
      const paused = await api(
        baseUrl,
        "POST",
        `/landlord/listings/${listingId}/pause`,
        { headers: activeHeaders, body: {} },
      );
      assert.equal(paused.response.status, 200);
      assert.equal(paused.body.data.status, "PAUSED");
      const rented = await api(
        baseUrl,
        "POST",
        `/landlord/listings/${listingId}/mark-rented`,
        { headers: activeHeaders, body: {} },
      );
      assert.equal(rented.response.status, 200);
      assert.equal(rented.body.data.status, "RENTED");
      assert.equal(rented.body.data.availableUnits, 0);
      const archived = await api(
        baseUrl,
        "DELETE",
        `/landlord/listings/${listingId}`,
        { headers: activeHeaders },
      );
      assert.equal(archived.response.status, 200);
      assert.equal(archived.body.data.status, "ARCHIVED");

      const expired = await register(baseUrl, expiredEmail, password);
      const expiredHeaders = bearer(expired.body.data.accessToken);
      await api(baseUrl, "POST", "/me/onboarding/role", {
        headers: expiredHeaders,
        body: { role: "LANDLORD" },
      });
      const expiredUser = await database.query(
        "SELECT id FROM users WHERE email = $1",
        [expiredEmail],
      );
      const expiredUserId = expiredUser.rows[0].id;
      const trialStartedAt = new Date(Date.now() - 8 * 86_400_000);
      const trialEndsAt = new Date(trialStartedAt.getTime() + 7 * 86_400_000);
      await database.query(
        `INSERT INTO landlord_profiles (user_id, display_name, contact_phone)
         VALUES ($1, 'Expired Owner', '011111111')`,
        [expiredUserId],
      );
      await database.query(
        `INSERT INTO landlord_entitlements (
           landlord_id, status, source, trial_started_at, trial_ends_at, access_ends_at
         ) VALUES ($1, 'trialing', 'trial', $2, $3, $3)`,
        [
          expiredUserId,
          trialStartedAt.toISOString(),
          trialEndsAt.toISOString(),
        ],
      );
      const expiredPropertyId = randomUUID();
      const expiredListingId = randomUUID();
      await database.query(
        `INSERT INTO properties (
           id, landlord_id, name, address_line, latitude, longitude, total_units
         ) VALUES ($1, $2, 'Expired property', 'Phnom Penh', 11.56, 104.90, 2)`,
        [expiredPropertyId, expiredUserId],
      );
      await database.query(
        `INSERT INTO listings (
           id, property_id, landlord_id, slug, title_en, property_type,
           monthly_price, currency, available_units
         ) VALUES ($1, $2, $3, $4, 'Retained room', 'room', 90, 'USD', 1)`,
        [
          expiredListingId,
          expiredPropertyId,
          expiredUserId,
          `expired-${randomUUID()}`,
        ],
      );

      const expiredCreate = await api(baseUrl, "POST", "/landlord/listings", {
        headers: expiredHeaders,
        body: validListingInput(amenityId),
      });
      assert.equal(expiredCreate.response.status, 403);
      assert.equal(
        expiredCreate.body.error.code,
        "LANDLORD_ENTITLEMENT_REQUIRED",
      );
      const expiredRead = await api(
        baseUrl,
        "GET",
        `/landlord/listings/${expiredListingId}`,
        { headers: expiredHeaders },
      );
      assert.equal(expiredRead.response.status, 200);
      assert.equal(expiredRead.body.data.titleEn, "Retained room");
      const safeMetadataEdit = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${expiredListingId}`,
        { headers: expiredHeaders, body: { titleEn: "Retained edited room" } },
      );
      assert.equal(safeMetadataEdit.response.status, 200);
      const expiredDecrease = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${expiredListingId}/availability`,
        { headers: expiredHeaders, body: { availableUnits: 0 } },
      );
      assert.equal(expiredDecrease.response.status, 200);
      const expiredIncrease = await api(
        baseUrl,
        "PATCH",
        `/landlord/listings/${expiredListingId}/availability`,
        { headers: expiredHeaders, body: { availableUnits: 1 } },
      );
      assert.equal(expiredIncrease.response.status, 403);
      assert.equal(
        expiredIncrease.body.error.code,
        "LANDLORD_ENTITLEMENT_REQUIRED",
      );
    } finally {
      await database.query(
        `DELETE FROM listings
         WHERE landlord_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))`,
        [
          [
            activeEmail,
            otherEmail,
            incompleteEmail,
            expiredEmail,
            studentEmail,
          ],
        ],
      );
      await database.query(
        `DELETE FROM properties
         WHERE landlord_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))`,
        [
          [
            activeEmail,
            otherEmail,
            incompleteEmail,
            expiredEmail,
            studentEmail,
          ],
        ],
      );
      await database.query(
        `UPDATE users
         SET account_status = 'deleted', deleted_at = CURRENT_TIMESTAMP
         WHERE email = ANY($1::text[])`,
        [
          [
            activeEmail,
            otherEmail,
            incompleteEmail,
            expiredEmail,
            studentEmail,
          ],
        ],
      );
      await database.query("DELETE FROM amenities WHERE id = $1", [amenityId]);
      await database.end();
      if (server.exitCode === null) {
        server.kill("SIGTERM");
        await new Promise((resolve) => server.once("exit", resolve));
      }
    }
  },
);

function validListingInput(amenityId, overrides = {}) {
  const { property: propertyOverrides = {}, ...listingOverrides } = overrides;
  return {
    titleKm: "បន្ទប់ជួលជិតសាកលវិទ្យាល័យ",
    titleEn: "Student room near RUPP",
    descriptionEn: "Quiet room suitable for a student.",
    propertyType: "ROOM",
    monthlyPrice: 95,
    currency: "USD",
    depositAmount: 95,
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    availableFrom: "2026-09-10",
    availableUnits: 2,
    contactPreference: "PHONE_OR_TELEGRAM",
    amenityIds: [amenityId],
    ...listingOverrides,
    property: {
      name: "RUPP Student Rooms",
      addressLine: "Russian Federation Boulevard, Phnom Penh",
      district: "Toul Kork",
      latitude: 11.569,
      longitude: 104.8914,
      totalUnits: 3,
      ...propertyOverrides,
    },
  };
}

async function activateLandlord(
  baseUrl,
  headers,
  displayName,
  includeTelegram = true,
) {
  const role = await api(baseUrl, "POST", "/me/onboarding/role", {
    headers,
    body: { role: "LANDLORD" },
  });
  assert.equal(role.response.status, 200);
  const profile = await api(baseUrl, "POST", "/landlord/onboarding", {
    headers,
    body: {
      displayName,
      contactPhone: "012345678",
      ...(includeTelegram ? { contactTelegram: "findme_test_owner" } : {}),
    },
  });
  assert.equal(profile.response.status, 200);
}

async function register(baseUrl, email, password) {
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
