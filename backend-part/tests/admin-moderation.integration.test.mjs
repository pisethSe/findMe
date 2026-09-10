import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { config as loadEnvironment } from "dotenv";
import { SignJWT } from "jose";
import pg from "pg";

loadEnvironment({
  path: new URL("../../.env", import.meta.url).pathname,
  quiet: true,
});
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test(
  "admin moderation protects roles, audits decisions, suspends supply and maintains catalogs",
  { skip: !testDatabaseUrl, timeout: 90000 },
  async () => {
    const db = new pg.Client({ connectionString: testDatabaseUrl });
    const base = "http://127.0.0.1:32188/api/v1";
    const secret = "inquiry-test-access-secret-at-least-32-characters";
    const students = [randomUUID(), randomUUID()];
    const owners = [randomUUID(), randomUUID()];
    const admin = randomUUID();
    const unfinished = randomUUID();
    const institutionId = randomUUID();
    const amenityId = randomUUID();
    const property = randomUUID();
    const listingIds = Array.from({ length: 12 }, () => randomUUID());
    const server = spawn(process.execPath, ["dist/main.js"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        APP_ENV: "test",
        PORT: "32188",
        DATABASE_URL: testDatabaseUrl,
        REDIS_URL: "redis://127.0.0.1:6398",
        WEB_ORIGIN: "http://localhost:3000",
        JWT_ACCESS_SECRET: secret,
        REFRESH_TOKEN_SECRET: "inquiry-refresh-secret-at-least-32-characters",
        JWT_ACCESS_TTL: "15m",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    server.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    server.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    const token = (id) =>
      new SignJWT({
        tokenUse: "access",
        role: "STUDENT",
        preferredLocale: "EN",
        onboardingComplete: true,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("findme-api")
        .setAudience("findme-web")
        .setSubject(id)
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(new TextEncoder().encode(secret));
    const api = async (method, path, accessToken, body) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { response, body: await response.json() };
    };
    const newInput = () => ({
      reason: "INACCURATE",
      details: "Incorrect monthly price",
    });
    await db.connect();
    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (server.exitCode !== null) throw new Error(output);
        if (
          await fetch(`${base}/health/live`)
            .then((r) => r.ok)
            .catch(() => false)
        )
          break;
        if (attempt === 99) throw new Error("Inquiry API did not start.");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      for (const [id, role] of [
        ...students.map((id) => [id, "student"]),
        ...owners.map((id) => [id, "landlord"]),
        [admin, "admin"],
        [unfinished, null],
      ])
        await db.query(
          "INSERT INTO users(id,email,password_hash,role,onboarding_completed_at) VALUES($1,$2,'PRIVATE_HASH',$3::user_role,$4)",
          [id, `${id}@example.test`, role, role ? new Date() : null],
        );
      await db.query(
        "INSERT INTO student_profiles(user_id,display_name) VALUES($1,'Dara Student'),($2,'Other Student')",
        students,
      );
      // These rentals also enter the shared moderation queue during this test.
      await db.query(
        "INSERT INTO landlord_profiles(user_id,display_name,contact_phone) VALUES($1,'Inquiry owner','+85512345678'),($2,'Other inquiry owner','+85512345679')",
        owners,
      );
      await db.query(
        "INSERT INTO properties(id,landlord_id,name,address_line,latitude,longitude,total_units) VALUES($1,$2,'Student rooms','PRIVATE_ADDRESS',11.57,104.89,20)",
        [property, owners[0]],
      );
      for (const id of listingIds)
        await db.query(
          "INSERT INTO listings(id,property_id,landlord_id,slug,title_en,title_km,property_type,monthly_price,currency,available_units,status,published_at,availability_confirmed_at,moderation_note) VALUES($1,$2,$3,$4,'Published room','បន្ទប់ជួល','room',125,'USD',1,'published',now(),now(),'PRIVATE_NOTE')",
          [id, property, owners[0], `inquiry-${id}`],
        );
      const a = await token(admin);
      const student = await token(students[0]);
      const owner = await token(owners[0]);
      for (const path of [
        "/admin/reports",
        "/admin/users",
        "/admin/listings",
        "/admin/listings/pending",
        "/admin/institutions",
        "/admin/amenities",
      ]) {
        assert.equal((await api("GET", path, undefined)).response.status, 401);
        assert.equal((await api("GET", path, student)).response.status, 403);
        assert.equal((await api("GET", path, owner)).response.status, 403);
        const result = await api("GET", path, a);
        assert.equal(result.response.status, 200, JSON.stringify(result.body));
        assert.match(result.response.headers.get("cache-control"), /private/);
        assert.doesNotMatch(
          JSON.stringify(result.body),
          /passwordHash|tokenHash|password_hash|PRIVATE_HASH/,
        );
      }
      const report = (
        await api(
          "POST",
          `/listings/${listingIds[0]}/reports`,
          student,
          newInput(),
        )
      ).body.data;
      const reportPath = `/admin/reports/${report.id}`;
      for (const identity of [student, owner]) {
        assert.equal(
          (
            await api("PATCH", reportPath, identity, {
              expectedStatus: "OPEN",
              status: "RESOLVED",
              note: "Verified issue",
            })
          ).response.status,
          403,
        );
        assert.equal(
          (
            await api("POST", `/admin/users/${owners[0]}/suspend`, identity, {
              note: "Abuse report",
            })
          ).response.status,
          403,
        );
        assert.equal(
          (
            await api(
              "POST",
              `/admin/listings/${listingIds[0]}/pause`,
              identity,
              { expectedStatus: "PUBLISHED", note: "Incorrect price" },
            )
          ).response.status,
          403,
        );
        assert.equal(
          (await api("POST", "/admin/amenities", identity, {})).response.status,
          403,
        );
      }
      assert.equal(
        (
          await api("PATCH", reportPath, a, {
            expectedStatus: "OPEN",
            status: "IN_REVIEW",
            note: "Checking details",
            resolvedById: admin,
          })
        ).response.status,
        400,
      );
      assert.equal(
        (
          await api("PATCH", reportPath, a, {
            expectedStatus: "OPEN",
            status: "IN_REVIEW",
            note: "Checking details",
          })
        ).response.status,
        200,
      );
      assert.equal(
        (
          await api("PATCH", reportPath, a, {
            expectedStatus: "OPEN",
            status: "RESOLVED",
            note: "Verified issue",
          })
        ).response.status,
        409,
      );
      const done = await api("PATCH", reportPath, a, {
        expectedStatus: "IN_REVIEW",
        status: "RESOLVED",
        note: "Verified incorrect price",
      });
      assert.equal(done.response.status, 200);
      assert.ok(done.body.data.resolvedAt);
      assert.equal(
        (
          await db.query("SELECT resolved_by_id FROM reports WHERE id=$1", [
            report.id,
          ])
        ).rows[0].resolved_by_id,
        admin,
      );
      assert.equal(
        (
          await api("PATCH", reportPath, a, {
            expectedStatus: "RESOLVED",
            status: "DISMISSED",
            note: "Overwrite closed decision",
          })
        ).response.status,
        409,
      );
      assert.equal(
        (
          await db.query("SELECT status FROM listings WHERE id=$1", [
            listingIds[0],
          ])
        ).rows[0].status,
        "published",
      );
      const pause = await api(
        "POST",
        `/admin/listings/${listingIds[0]}/pause`,
        a,
        { expectedStatus: "PUBLISHED", note: "Verified misleading price" },
      );
      assert.equal(pause.response.status, 200, JSON.stringify(pause.body));
      assert.equal(
        (await api("GET", `/listings/inquiry-${listingIds[0]}`, student))
          .response.status,
        404,
      );
      assert.equal(
        (
          await api("POST", `/admin/listings/${listingIds[0]}/archive`, a, {
            expectedStatus: "PUBLISHED",
            note: "Remove prohibited rental",
          })
        ).response.status,
        409,
      );
      assert.equal(
        (
          await api("POST", `/admin/listings/${listingIds[0]}/archive`, a, {
            expectedStatus: "PAUSED",
            note: "Remove prohibited rental",
          })
        ).response.status,
        200,
      );
      assert.equal(
        (
          await api("POST", `/admin/users/${admin}/suspend`, a, {
            note: "Self suspension",
          })
        ).response.status,
        403,
      );
      await db.query(
        "INSERT INTO refresh_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')",
        [owners[0], randomUUID()],
      );
      assert.equal(
        (
          await api("POST", `/admin/users/${owners[0]}/suspend`, a, {
            note: "Confirmed abusive account",
          })
        ).response.status,
        200,
      );
      assert.equal(
        (await api("GET", "/landlord/listings", owner)).response.status,
        401,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM refresh_sessions WHERE user_id=$1 AND revoked_at IS NULL",
            [owners[0]],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM listings WHERE landlord_id=$1 AND status='published'",
            [owners[0]],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await api("POST", `/admin/users/${owners[0]}/reactivate`, a, {
            note: "Account issue corrected",
          })
        ).response.status,
        200,
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM listings WHERE landlord_id=$1 AND status='published'",
            [owners[0]],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await api("GET", "/admin/users?page=-1", a)).response.status,
        400,
      );
      assert.equal(
        (await api("GET", "/admin/reports?status=FAKE", a)).response.status,
        400,
      );
      const institution = {
        slug: `school-${institutionId}`,
        nameKm: "សាកលវិទ្យាល័យ",
        nameEn: "Admin test institution",
        type: "UNIVERSITY",
        addressEn: "Phnom Penh campus",
        city: "Phnom Penh",
        latitude: 11.57,
        longitude: 104.89,
        isActive: true,
      };
      const created = await api("POST", "/admin/institutions", a, institution);
      assert.equal(created.response.status, 201, JSON.stringify(created.body));
      const actualInstitution = created.body.data.id;
      await db.query("UPDATE institutions SET id=$1 WHERE id=$2", [
        institutionId,
        actualInstitution,
      ]);
      assert.equal(
        (await api("POST", "/admin/institutions", a, institution)).response
          .status,
        409,
      );
      assert.equal(
        (
          await api("PATCH", `/admin/institutions/${institutionId}`, a, {
            ...institution,
            latitude: 91,
          })
        ).response.status,
        400,
      );
      assert.equal(
        (
          await api("PATCH", `/admin/institutions/${institutionId}`, a, {
            ...institution,
            latitude: 11.58,
            isActive: false,
          })
        ).response.status,
        200,
      );
      assert.equal(
        (
          await db.query(
            "SELECT ST_Y(location::geometry)::float8 latitude FROM institutions WHERE id=$1",
            [institutionId],
          )
        ).rows[0].latitude,
        11.58,
      );
      const amenity = {
        key: `test-${amenityId}`,
        nameKm: "វ៉ាយហ្វាយ",
        nameEn: "Test Wi-Fi",
        category: "Internet",
        sortOrder: 1,
        isActive: true,
      };
      const amenityCreated = await api("POST", "/admin/amenities", a, amenity);
      assert.equal(amenityCreated.response.status, 201);
      await db.query("UPDATE amenities SET id=$1 WHERE id=$2", [
        amenityId,
        amenityCreated.body.data.id,
      ]);
      assert.equal(
        (
          await api("PATCH", `/admin/amenities/${amenityId}`, a, {
            ...amenity,
            isActive: false,
          })
        ).response.status,
        200,
      );
      const actions = (
        await db.query("SELECT action FROM audit_logs WHERE actor_id=$1", [
          admin,
        ])
      ).rows.map((r) => r.action);
      for (const action of [
        "REPORT_REVIEWED",
        "LISTING_PAUSED_BY_ADMIN",
        "LISTING_ARCHIVED_BY_ADMIN",
        "USER_SUSPENDED",
        "USER_REACTIVATED",
        "INSTITUTION_CREATED",
        "INSTITUTION_UPDATED",
        "AMENITY_CREATED",
        "AMENITY_UPDATED",
      ])
        assert.ok(actions.includes(action), action);
    } finally {
      server.kill("SIGTERM");
      await db.query("DELETE FROM institutions WHERE id=$1", [institutionId]);
      await db.query("DELETE FROM amenities WHERE id=$1", [amenityId]);
      await db.query("DELETE FROM reports WHERE listing_id=ANY($1::uuid[])", [
        listingIds,
      ]);
      await db.query("DELETE FROM listings WHERE id=ANY($1::uuid[])", [
        listingIds,
      ]);
      await db.query("DELETE FROM properties WHERE id=$1", [property]);
      await db.query(
        "UPDATE users SET account_status='deleted',deleted_at=now() WHERE id=ANY($1::uuid[])",
        [[...students, ...owners, admin, unfinished]],
      );
      await db.end();
      await new Promise((resolve) => {
        if (server.exitCode !== null || server.signalCode !== null) resolve();
        else server.once("exit", resolve);
      });
    }
  },
);
