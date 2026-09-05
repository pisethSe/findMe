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
  "landlord inquiry reads are paginated, private, and ownership scoped",
  { skip: !testDatabaseUrl, timeout: 30_000 },
  async () => {
    const port = 32_176;
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;
    const password = "dashboard-password-123";
    const landlordEmail = `dashboard-owner-${randomUUID()}@example.test`;
    const otherEmail = `dashboard-other-${randomUUID()}@example.test`;
    const studentEmail = `dashboard-student-${randomUUID()}@example.test`;
    const server = spawn(process.execPath, ["dist/main.js"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        APP_ENV: "test",
        PORT: String(port),
        WEB_ORIGIN: "http://localhost:3000",
        DATABASE_URL: testDatabaseUrl,
        JWT_ACCESS_SECRET: "dashboard-access-secret-is-long-and-unique",
        REFRESH_TOKEN_SECRET:
          "dashboard-refresh-secret-is-also-long-and-unique",
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

      const landlord = await register(baseUrl, landlordEmail, password);
      const landlordHeaders = bearer(landlord.body.data.accessToken);
      await activateLandlord(baseUrl, landlordHeaders, "Sokha Owner");
      const other = await register(baseUrl, otherEmail, password);
      const otherHeaders = bearer(other.body.data.accessToken);
      await activateLandlord(baseUrl, otherHeaders, "Other Owner");
      const student = await register(baseUrl, studentEmail, password);
      const studentHeaders = bearer(student.body.data.accessToken);
      await api(baseUrl, "POST", "/me/onboarding/role", {
        headers: studentHeaders,
        body: { role: "STUDENT", displayName: "Dara Student" },
      });

      const listing = await api(baseUrl, "POST", "/landlord/listings", {
        headers: landlordHeaders,
        body: validListingInput(),
      });
      assert.equal(listing.response.status, 201);
      const listingId = listing.body.data.id;
      const users = await database.query(
        "SELECT id, email FROM users WHERE email = ANY($1::text[])",
        [[landlordEmail, studentEmail]],
      );
      const landlordId = users.rows.find(
        (row) => row.email === landlordEmail,
      ).id;
      const studentId = users.rows.find((row) => row.email === studentEmail).id;
      await database.query(
        `UPDATE listings
         SET status = 'published', published_at = CURRENT_TIMESTAMP,
             availability_confirmed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [listingId],
      );

      const olderInquiryId = randomUUID();
      const newestInquiryId = randomUUID();
      await database.query(
        `INSERT INTO inquiries (
           id, listing_id, student_id, landlord_id, message, status, read_at,
           created_at
         ) VALUES
           ($1, $3, $4, $5, 'Is electricity billed separately?', 'read',
            CURRENT_TIMESTAMP - INTERVAL '25 minutes',
            CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
           ($2, $3, $4, $5, 'Can I visit the room this Saturday?', 'new', NULL,
            CURRENT_TIMESTAMP - INTERVAL '5 minutes')`,
        [olderInquiryId, newestInquiryId, listingId, studentId, landlordId],
      );

      const unauthenticated = await api(baseUrl, "GET", "/landlord/inquiries");
      assert.equal(unauthenticated.response.status, 401);
      const studentRead = await api(baseUrl, "GET", "/landlord/inquiries", {
        headers: studentHeaders,
      });
      assert.equal(studentRead.response.status, 403);

      const firstPage = await api(
        baseUrl,
        "GET",
        "/landlord/inquiries?page=1&pageSize=1",
        { headers: landlordHeaders },
      );
      assert.equal(firstPage.response.status, 200);
      assert.equal(firstPage.body.meta.total, 2);
      assert.equal(firstPage.body.meta.totalPages, 2);
      assert.equal(firstPage.body.data.length, 1);
      assert.equal(firstPage.body.data[0].id, newestInquiryId);
      assert.equal(firstPage.body.data[0].student.displayName, "Dara Student");
      assert.equal(firstPage.body.data[0].listing.id, listingId);
      assert.equal(firstPage.body.data[0].listing.propertyName, "RUPP Rooms");
      assert.equal("studentId" in firstPage.body.data[0], false);
      assert.equal("email" in firstPage.body.data[0].student, false);

      const otherOwnerRead = await api(
        baseUrl,
        "GET",
        "/landlord/inquiries?page=1&pageSize=5",
        { headers: otherHeaders },
      );
      assert.equal(otherOwnerRead.response.status, 200);
      assert.equal(otherOwnerRead.body.meta.total, 0);
      assert.deepEqual(otherOwnerRead.body.data, []);

      const invalidPage = await api(
        baseUrl,
        "GET",
        "/landlord/inquiries?page=0&pageSize=100",
        { headers: landlordHeaders },
      );
      assert.equal(invalidPage.response.status, 400);
      assert.equal(invalidPage.body.error.code, "VALIDATION_FAILED");
    } finally {
      await database.query(
        `DELETE FROM inquiries
         WHERE landlord_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))`,
        [[landlordEmail, otherEmail]],
      );
      await database.query(
        `DELETE FROM listings
         WHERE landlord_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))`,
        [[landlordEmail, otherEmail]],
      );
      await database.query(
        `DELETE FROM properties
         WHERE landlord_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))`,
        [[landlordEmail, otherEmail]],
      );
      await database.query(
        `UPDATE users
         SET account_status = 'deleted', deleted_at = CURRENT_TIMESTAMP
         WHERE email = ANY($1::text[])`,
        [[landlordEmail, otherEmail, studentEmail]],
      );
      await database.end();
      if (server.exitCode === null) {
        server.kill("SIGTERM");
        await new Promise((resolve) => server.once("exit", resolve));
      }
    }
  },
);

function validListingInput() {
  return {
    titleKm: "បន្ទប់ជួលជិតសាកលវិទ្យាល័យ",
    titleEn: "Student room near RUPP",
    propertyType: "ROOM",
    monthlyPrice: 95,
    currency: "USD",
    availableUnits: 2,
    contactPreference: "IN_APP_ONLY",
    property: {
      name: "RUPP Rooms",
      addressLine: "Russian Federation Boulevard, Phnom Penh",
      latitude: 11.569,
      longitude: 104.8914,
      totalUnits: 3,
    },
  };
}

async function activateLandlord(baseUrl, headers, displayName) {
  const role = await api(baseUrl, "POST", "/me/onboarding/role", {
    headers,
    body: { role: "LANDLORD" },
  });
  assert.equal(role.response.status, 200);
  const profile = await api(baseUrl, "POST", "/landlord/onboarding", {
    headers,
    body: { displayName, contactPhone: "012345678" },
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
