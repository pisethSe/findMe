import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { config as loadEnvironment } from "dotenv";
import { SignJWT } from "jose";
import pg from "pg";
import { PrismaService } from "../dist/database/prisma.service.js";
import { ListingsRepository } from "../dist/modules/listings/listings.repository.js";

loadEnvironment({
  path: new URL("../../.env", import.meta.url).pathname,
  quiet: true,
});
const url = process.env.TEST_DATABASE_URL;

test(
  "stale supply leaves all public paths; owner confirmation restores only eligible inventory",
  { skip: !url, timeout: 45000 },
  async () => {
    const db = new pg.Client({ connectionString: url });
    const base = "http://127.0.0.1:32194/api/v1";
    const secret = "stale-listing-test-access-secret-at-least-32-characters";
    const owner = randomUUID(),
      other = randomUUID(),
      student = randomUUID(),
      admin = randomUUID();
    const property = randomUUID(),
      listing = randomUUID(),
      school = randomUUID(),
      amenity = randomUUID();
    const slug = `stale-${listing}`;
    const server = spawn(process.execPath, ["dist/main.js"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        APP_ENV: "test",
        PORT: "32194",
        DATABASE_URL: url,
        REDIS_URL: "",
        WEB_ORIGIN: "http://localhost:3000",
        JWT_ACCESS_SECRET: secret,
        REFRESH_TOKEN_SECRET:
          "stale-listing-refresh-secret-at-least-32-characters",
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
      return { status: response.status, body: await response.json() };
    };
    await db.connect();
    let prisma;
    try {
      for (let attempt = 0; attempt < 150; attempt++) {
        if (server.exitCode !== null) throw new Error(output);
        if (
          await fetch(`${base}/health/live`)
            .then((r) => r.ok)
            .catch(() => false)
        )
          break;
        if (attempt === 149)
          throw new Error("Stale-listing API did not start.");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      for (const [id, role] of [
        [owner, "landlord"],
        [other, "landlord"],
        [student, "student"],
        [admin, "admin"],
      ]) {
        await db.query(
          "INSERT INTO users(id,email,password_hash,role,onboarding_completed_at) VALUES($1,$2,'UNUSABLE',$3::user_role,now())",
          [id, `${id}@example.test`, role],
        );
      }
      await db.query(
        "INSERT INTO landlord_profiles(user_id,display_name,contact_phone) VALUES($1,'Availability owner','012345678'),($2,'Other owner','012345679')",
        [owner, other],
      );
      await db.query(
        "INSERT INTO student_profiles(user_id,display_name) VALUES($1,'Student')",
        [student],
      );
      await db.query(
        "INSERT INTO landlord_entitlements(landlord_id,status,source) VALUES($1,'active','admin_grant')",
        [owner],
      );
      await db.query(
        "INSERT INTO properties(id,landlord_id,name,address_line,latitude,longitude,total_units) VALUES($1,$2,'Rooms','Student street',11.57,104.89,3)",
        [property, owner],
      );
      await db.query(
        "INSERT INTO institutions(id,slug,name_en,name_km,type,latitude,longitude) VALUES($1,$2,'Test school','សាលាសាកល្បង','university',11.57,104.89)",
        [school, `stale-${school}`],
      );
      await db.query(
        "INSERT INTO amenities(id,key,name_en,name_km) VALUES($1,$2,'Test facility','សម្ភារៈ')",
        [amenity, `stale-${amenity}`],
      );
      await db.query(
        "INSERT INTO listings(id,property_id,landlord_id,slug,title_en,description_en,property_type,monthly_price,currency,available_units,status,published_at,availability_confirmed_at) VALUES($1,$2,$3,$4,'Student room','Quiet room for study','room',90,'USD',2,'published',now(),now())",
        [listing, property, owner, slug],
      );
      await db.query(
        "INSERT INTO listing_amenities(listing_id,amenity_id) VALUES($1,$2)",
        [listing, amenity],
      );
      await db.query(
        "INSERT INTO listing_images(listing_id,storage_key,public_url,status) VALUES($1,$2,'https://images.example.test/room.jpg','ready')",
        [listing, `stale/${listing}.jpg`],
      );
      const ownerToken = await token(owner),
        studentToken = await token(student),
        otherToken = await token(other),
        adminToken = await token(admin);
      const ownedPath = `/landlord/listings/${listing}`;
      const confirm = (body = { availableUnits: 2 }, access = ownerToken) =>
        api("PATCH", `${ownedPath}/availability`, access, body);
      const searchPath = `/listings/search?institutionId=${school}&amenities=stale-${amenity}`;
      assert.equal((await api("GET", searchPath)).body.meta.total, 1);
      assert.equal(
        (await api("PUT", `/me/favorites/${listing}`, studentToken, {})).status,
        200,
      );
      const inquiryInput = {
        message: "Is the room available?",
        clientRequestId: randomUUID(),
      };
      const inquiry = await api(
        "POST",
        `/listings/${listing}/inquiries`,
        studentToken,
        inquiryInput,
      );
      assert.equal(inquiry.status, 201);
      await db.query(
        "UPDATE listings SET availability_confirmed_at=now()-interval '7 days' WHERE id=$1",
        [listing],
      );
      assert.equal(
        (await api("GET", ownedPath, ownerToken)).body.data
          .availabilityFreshness.state,
        "DUE",
      );
      assert.equal((await api("GET", searchPath)).body.meta.total, 1);
      await db.query(
        "UPDATE listings SET availability_confirmed_at=now()-interval '14 days' WHERE id=$1",
        [listing],
      );
      const stale = await api("GET", ownedPath, ownerToken);
      assert.equal(stale.body.data.status, "PUBLISHED");
      assert.equal(stale.body.data.availabilityFreshness.state, "STALE");
      assert.equal((await api("GET", searchPath)).body.meta.total, 0);
      assert.equal((await api("GET", `/listings/${slug}`)).status, 404);
      const saved = await api("GET", "/me/favorites", studentToken);
      assert.equal(saved.body.data[0].listing, null);
      assert.equal(
        (await api("GET", "/me/inquiries", studentToken)).body.data[0].listing,
        null,
      );
      assert.equal(
        (
          await api("POST", `/listings/${listing}/inquiries`, studentToken, {
            ...inquiryInput,
            clientRequestId: randomUUID(),
          })
        ).status,
        404,
      );
      // Historical retry remains idempotent, without exposing withdrawn content.
      const replay = await api(
        "POST",
        `/listings/${listing}/inquiries`,
        studentToken,
        inquiryInput,
      );
      assert.equal(replay.body.data.id, inquiry.body.data.id);
      assert.equal(replay.body.data.listing, null);
      await api("DELETE", `/me/favorites/${listing}`, studentToken);
      assert.equal(
        (await api("PUT", `/me/favorites/${listing}`, studentToken, {})).status,
        404,
      );
      assert.equal((await confirm(undefined, otherToken)).status, 404);
      assert.equal((await confirm(undefined, studentToken)).status, 403);
      assert.equal(
        (
          await api("PATCH", `${ownedPath}/availability`, undefined, {
            availableUnits: 2,
          })
        ).status,
        401,
      );
      for (const injected of [
        { availabilityConfirmedAt: new Date().toISOString() },
        { availabilityFreshness: { state: "FRESH" } },
        { status: "PUBLISHED" },
        { landlordId: other },
      ])
        assert.equal(
          (await confirm({ availableUnits: 2, ...injected })).status,
          400,
        );
      const refreshed = await confirm();
      assert.equal(refreshed.status, 200);
      assert.equal(refreshed.body.data.status, "PUBLISHED");
      assert.equal(refreshed.body.data.availabilityFreshness.state, "FRESH");
      assert.equal(refreshed.body.data.availableUnits, 2);
      assert.equal(
        refreshed.body.data.publishedAt,
        stale.body.data.publishedAt,
      );
      assert.equal((await api("GET", searchPath)).body.meta.total, 1);
      assert.equal((await api("GET", `/listings/${slug}`)).status, 200);

      // Stale pending submissions cannot be approved or silently freshened by an admin.
      await db.query(
        "UPDATE listings SET status='pending_review',availability_confirmed_at=now()-interval '15 days' WHERE id=$1",
        [listing],
      );
      const denied = await api(
        "POST",
        `/admin/listings/${listing}/approve`,
        adminToken,
        {},
      );
      assert.equal(denied.status, 409);
      assert.equal(denied.body.error.code, "LISTING_AVAILABILITY_STALE");
      assert.equal((await confirm()).body.data.status, "PENDING_REVIEW");
      assert.equal(
        (
          await api(
            "POST",
            `/admin/listings/${listing}/approve`,
            adminToken,
            {},
          )
        ).status,
        200,
      );
      for (const status of ["paused", "rejected", "rented", "draft"]) {
        await db.query(
          "UPDATE listings SET status=$1::listing_status,availability_confirmed_at=now()-interval '15 days' WHERE id=$2",
          [status, listing],
        );
        assert.equal((await confirm()).body.data.status, status.toUpperCase());
        assert.equal((await api("GET", searchPath)).body.meta.total, 0);
      }
      // A metadata edit is not an availability confirmation.
      await db.query(
        "UPDATE listings SET availability_confirmed_at=now()-interval '15 days' WHERE id=$1",
        [listing],
      );
      const edit = await api("PATCH", ownedPath, ownerToken, {
        titleEn: "Edited title",
      });
      assert.equal(edit.body.data.availabilityFreshness.state, "STALE");

      // The write guard handles expiry even if the periodic runner has not run.
      await db.query("UPDATE listings SET status='published' WHERE id=$1", [
        listing,
      ]);
      await db.query(
        "UPDATE landlord_entitlements SET access_ends_at=now()-interval '1 second' WHERE landlord_id=$1",
        [owner],
      );
      const expiredConfirmation = await confirm({ availableUnits: 1 });
      assert.equal(expiredConfirmation.status, 200);
      assert.equal(expiredConfirmation.body.data.status, "PAUSED");
      assert.equal(expiredConfirmation.body.data.availableUnits, 1);
      assert.equal((await confirm()).status, 403);
      assert.equal((await api("GET", searchPath)).body.meta.total, 0);
      assert.equal(
        (await api("GET", "/landlord/inquiries", ownerToken)).body.meta.total,
        1,
      );

      // Compare room counts atomically: an old snapshot cannot undo another reduction.
      const previousUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = url;
      try {
        prisma = new PrismaService();
      } finally {
        if (previousUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previousUrl;
      }
      await prisma.$connect();
      const repository = new ListingsRepository(prisma);
      assert.equal(
        await repository.updateAvailability(listing, owner, "PAUSED", 2, {
          availableUnits: 2,
          availabilityConfirmedAt: new Date(),
        }),
        null,
      );
      assert.equal(
        (
          await db.query("SELECT available_units FROM listings WHERE id=$1", [
            listing,
          ])
        ).rows[0].available_units,
        1,
      );
      await db.query("UPDATE listings SET status='archived' WHERE id=$1", [
        listing,
      ]);
      assert.equal((await confirm({ availableUnits: 1 })).status, 409);
    } finally {
      server.kill("SIGTERM");
      await new Promise((resolve) => {
        if (server.exitCode !== null || server.signalCode !== null) resolve();
        else server.once("exit", resolve);
      });
      if (prisma) await prisma.$disconnect();
      try {
        await db.query("DELETE FROM inquiries WHERE listing_id=$1", [listing]);
        await db.query("DELETE FROM favorites WHERE listing_id=$1", [listing]);
        await db.query("DELETE FROM listings WHERE id=$1", [listing]);
        await db.query("DELETE FROM properties WHERE id=$1", [property]);
        await db.query(
          "UPDATE users SET account_status='deleted',deleted_at=now() WHERE id=ANY($1::uuid[])",
          [[owner, other, student, admin]],
        );
        await db.query("DELETE FROM institutions WHERE id=$1", [school]);
        await db.query("DELETE FROM amenities WHERE id=$1", [amenity]);
      } finally {
        await db.end();
      }
    }
  },
);
