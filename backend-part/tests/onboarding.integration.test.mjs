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
  "role and landlord onboarding are one-time, authorized, and server-timed",
  { skip: !testDatabaseUrl, timeout: 30_000 },
  async () => {
    const port = 32_174;
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;
    const studentEmail = `onboarding-student-${randomUUID()}@example.test`;
    const landlordEmail = `onboarding-landlord-${randomUUID()}@example.test`;
    const expiredEmail = `onboarding-expired-${randomUUID()}@example.test`;
    const password = "onboarding-password-123";
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

      const unauthenticatedOnboarding = await apiGet(
        `${baseUrl}/me/onboarding`,
      );
      assert.equal(unauthenticatedOnboarding.response.status, 401);
      assert.equal(
        unauthenticatedOnboarding.body.error.code,
        "ACCESS_TOKEN_REQUIRED",
      );

      const student = await register(baseUrl, studentEmail, password);
      const studentHeaders = bearer(student.body.data.accessToken);
      const initial = await apiGet(`${baseUrl}/me/onboarding`, studentHeaders);
      assert.equal(initial.response.status, 200);
      assert.deepEqual(initial.body.data, {
        role: null,
        stage: "ROLE_SELECTION",
        nextPath: "/onboarding/role",
        roleSelectionComplete: false,
        profileComplete: false,
        landlordTrialActivated: false,
      });

      const selfAssignedAdmin = await apiPost(
        `${baseUrl}/me/onboarding/role`,
        { role: "ADMIN" },
        studentHeaders,
      );
      assert.equal(selfAssignedAdmin.response.status, 400);
      assert.equal(selfAssignedAdmin.body.error.code, "VALIDATION_FAILED");

      const missingStudentName = await apiPost(
        `${baseUrl}/me/onboarding/role`,
        { role: "STUDENT" },
        studentHeaders,
      );
      assert.equal(missingStudentName.response.status, 400);
      assert.equal(
        missingStudentName.body.error.code,
        "STUDENT_PROFILE_REQUIRED",
      );

      const selectedStudent = await apiPost(
        `${baseUrl}/me/onboarding/role`,
        { role: "STUDENT", displayName: "Sokha Student" },
        studentHeaders,
      );
      assert.equal(selectedStudent.response.status, 200);
      assert.equal(selectedStudent.body.data.role, "STUDENT");
      assert.equal(selectedStudent.body.data.nextPath, "/search");
      assert.equal(selectedStudent.body.data.profileComplete, true);

      const repeatedStudent = await apiPost(
        `${baseUrl}/me/onboarding/role`,
        { role: "STUDENT" },
        studentHeaders,
      );
      assert.equal(repeatedStudent.response.status, 200);
      const studentProfile = await database.query(
        `SELECT sp.display_name, u.role
         FROM users u
         JOIN student_profiles sp ON sp.user_id = u.id
         WHERE u.email = $1`,
        [studentEmail],
      );
      assert.deepEqual(studentProfile.rows[0], {
        display_name: "Sokha Student",
        role: "student",
      });

      const changedRole = await apiPost(
        `${baseUrl}/me/onboarding/role`,
        { role: "LANDLORD" },
        studentHeaders,
      );
      assert.equal(changedRole.response.status, 409);
      assert.equal(changedRole.body.error.code, "ROLE_ALREADY_SELECTED");

      const studentAsLandlord = await apiPost(
        `${baseUrl}/landlord/onboarding`,
        {
          displayName: "Not a landlord",
          contactPhone: "012345678",
        },
        studentHeaders,
      );
      assert.equal(studentAsLandlord.response.status, 403);
      assert.equal(studentAsLandlord.body.error.code, "ROLE_FORBIDDEN");
      const studentEntitlement = await apiGet(
        `${baseUrl}/landlord/entitlement`,
        studentHeaders,
      );
      assert.equal(studentEntitlement.response.status, 403);
      assert.equal(studentEntitlement.body.error.code, "ROLE_FORBIDDEN");

      const landlord = await register(baseUrl, landlordEmail, password);
      const landlordHeaders = bearer(landlord.body.data.accessToken);
      const landlordRoleWithProfileField = await apiPost(
        `${baseUrl}/me/onboarding/role`,
        { role: "LANDLORD", displayName: "Too early" },
        landlordHeaders,
      );
      assert.equal(landlordRoleWithProfileField.response.status, 400);
      assert.equal(
        landlordRoleWithProfileField.body.error.code,
        "ROLE_PROFILE_FIELDS_INVALID",
      );

      const selectedLandlord = await apiPost(
        `${baseUrl}/me/onboarding/role`,
        { role: "LANDLORD" },
        landlordHeaders,
      );
      assert.equal(selectedLandlord.response.status, 200);
      assert.equal(selectedLandlord.body.data.nextPath, "/onboarding/landlord");
      assert.equal(selectedLandlord.body.data.landlordTrialActivated, false);

      const clientControlledTrial = await apiPost(
        `${baseUrl}/landlord/onboarding`,
        {
          displayName: "Dara Owner",
          contactPhone: "012 345 678",
          trialStartedAt: "2030-01-01T00:00:00.000Z",
        },
        landlordHeaders,
      );
      assert.equal(clientControlledTrial.response.status, 400);
      assert.equal(clientControlledTrial.body.error.code, "VALIDATION_FAILED");

      const activated = await apiPost(
        `${baseUrl}/landlord/onboarding`,
        {
          displayName: "Dara Owner",
          businessName: "RUPP Student Rooms",
          contactPhone: "012 345-678",
          contactTelegram: "dara_rooms",
        },
        landlordHeaders,
      );
      assert.equal(activated.response.status, 200);
      assert.equal(activated.body.data.onboarding.nextPath, "/landlord");
      assert.equal(
        activated.body.data.successNextPath,
        "/landlord/listings/new",
      );
      assert.equal(activated.body.data.profile.contactPhone, "012345678");
      assert.equal(activated.body.data.profile.contactTelegram, "@dara_rooms");
      assert.equal(
        activated.body.data.profile.verificationStatus,
        "UNVERIFIED",
      );
      assert.equal(activated.body.data.entitlement.status, "TRIALING");
      assert.equal(activated.body.data.entitlement.source, "TRIAL");
      const trialStartedAt = new Date(
        activated.body.data.entitlement.trialStartedAt,
      );
      const trialEndsAt = new Date(activated.body.data.entitlement.trialEndsAt);
      assert.equal(
        trialEndsAt.getTime() - trialStartedAt.getTime(),
        604_800_000,
      );

      const repeatedActivation = await apiPost(
        `${baseUrl}/landlord/onboarding`,
        {
          displayName: "Replacement Owner",
          contactPhone: "098765432",
        },
        landlordHeaders,
      );
      assert.equal(repeatedActivation.response.status, 200);
      assert.equal(
        repeatedActivation.body.data.profile.displayName,
        "Dara Owner",
      );
      assert.equal(
        repeatedActivation.body.data.entitlement.trialStartedAt,
        activated.body.data.entitlement.trialStartedAt,
      );
      assert.equal(
        repeatedActivation.body.data.entitlement.trialEndsAt,
        activated.body.data.entitlement.trialEndsAt,
      );
      assert.equal(repeatedActivation.body.data.successNextPath, "/landlord");
      const durableLandlordState = await database.query(
        `SELECT
           (SELECT COUNT(*)::int FROM landlord_profiles WHERE user_id = u.id) AS profile_count,
           (SELECT COUNT(*)::int FROM landlord_entitlements WHERE landlord_id = u.id) AS entitlement_count
         FROM users u
         WHERE u.email = $1`,
        [landlordEmail],
      );
      assert.deepEqual(durableLandlordState.rows[0], {
        profile_count: 1,
        entitlement_count: 1,
      });

      const currentAccess = await apiGet(
        `${baseUrl}/landlord/entitlement`,
        landlordHeaders,
      );
      assert.equal(currentAccess.response.status, 200);
      assert.equal(currentAccess.body.data.isAccessActive, true);
      assert.equal(currentAccess.body.data.remainingDays, 7);
      assert.equal(
        currentAccess.body.data.capabilities.canCreateListings,
        true,
      );

      const expired = await register(baseUrl, expiredEmail, password);
      const expiredHeaders = bearer(expired.body.data.accessToken);
      await apiPost(
        `${baseUrl}/me/onboarding/role`,
        { role: "LANDLORD" },
        expiredHeaders,
      );
      const expiredUser = await database.query(
        "SELECT id FROM users WHERE email = $1",
        [expiredEmail],
      );
      const expiredTrialStartedAt = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1_000,
      );
      const expiredTrialEndsAt = new Date(
        expiredTrialStartedAt.getTime() + 7 * 24 * 60 * 60 * 1_000,
      );
      await database.query(
        `INSERT INTO landlord_profiles (user_id, display_name, contact_phone)
         VALUES ($1, 'Expired Owner', '011111111')`,
        [expiredUser.rows[0].id],
      );
      await database.query(
        `INSERT INTO landlord_entitlements (
           landlord_id, status, source, trial_started_at, trial_ends_at, access_ends_at
         ) VALUES ($1, 'trialing', 'trial', $2, $3, $3)`,
        [
          expiredUser.rows[0].id,
          expiredTrialStartedAt.toISOString(),
          expiredTrialEndsAt.toISOString(),
        ],
      );

      const expiredAccess = await apiGet(
        `${baseUrl}/landlord/entitlement`,
        expiredHeaders,
      );
      assert.equal(expiredAccess.response.status, 200);
      assert.equal(expiredAccess.body.data.status, "EXPIRED");
      assert.equal(expiredAccess.body.data.isAccessActive, false);
      assert.equal(
        expiredAccess.body.data.capabilities.canCreateListings,
        false,
      );
      assert.equal(expiredAccess.body.data.capabilities.canReadListings, true);

      const retained = await database.query(
        `SELECT lp.display_name, le.status
         FROM landlord_profiles lp
         JOIN landlord_entitlements le ON le.landlord_id = lp.user_id
         WHERE lp.user_id = $1`,
        [expiredUser.rows[0].id],
      );
      assert.deepEqual(retained.rows[0], {
        display_name: "Expired Owner",
        status: "expired",
      });
    } finally {
      await database.query(
        `UPDATE users
         SET account_status = 'deleted', deleted_at = CURRENT_TIMESTAMP
         WHERE email = ANY($1::text[])`,
        [[studentEmail, landlordEmail, expiredEmail]],
      );
      await database.end();
      if (server.exitCode === null) {
        server.kill("SIGTERM");
        await new Promise((resolve) => server.once("exit", resolve));
      }
    }
  },
);

async function register(baseUrl, email, password) {
  return apiPost(`${baseUrl}/auth/register`, {
    email,
    password,
    preferredLocale: "KM",
  });
}

async function apiPost(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

async function apiGet(url, headers = {}) {
  const response = await fetch(url, { headers });
  return { response, body: await response.json() };
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
