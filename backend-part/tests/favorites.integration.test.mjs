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
  "favorites are private, validated, idempotent and safe after rental withdrawal",
  { skip: !testDatabaseUrl, timeout: 45000 },
  async () => {
    const db = new pg.Client({ connectionString: testDatabaseUrl });
    const base = "http://127.0.0.1:32185/api/v1";
    const secret = "favorites-test-access-secret-at-least-32-characters";
    const students = [randomUUID(), randomUUID()];
    const owner = randomUUID();
    const admin = randomUUID();
    const unfinished = randomUUID();
    const property = randomUUID();
    const listingIds = [randomUUID(), randomUUID(), randomUUID()];
    const amenity = randomUUID();
    const server = spawn(process.execPath, ["dist/main.js"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        APP_ENV: "test",
        PORT: "32185",
        DATABASE_URL: testDatabaseUrl,
        REDIS_URL: "",
        WEB_ORIGIN: "http://localhost:3000",
        JWT_ACCESS_SECRET: secret,
        REFRESH_TOKEN_SECRET: "favorites-refresh-secret-at-least-32-characters",
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
    const request = async (method, path = "", accessToken, body) => {
      const response = await fetch(`${base}/me/favorites${path}`, {
        method,
        headers: {
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { response, payload: await response.json() };
    };
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
        if (attempt === 99) throw new Error("Favorites API did not start.");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      for (const [id, role, complete] of [
        ...students.map((id) => [id, "student", true]),
        [owner, "landlord", true],
        [admin, "admin", true],
        [unfinished, null, false],
      ]) {
        await db.query(
          "INSERT INTO users(id,email,password_hash,role,onboarding_completed_at) VALUES($1,$2,'private-hash',$3::user_role,$4)",
          [id, `${id}@example.test`, role, complete ? new Date() : null],
        );
      }
      // Pending-review fixtures need the same owner profile as real rentals.
      await db.query(
        "INSERT INTO landlord_profiles(user_id,display_name,contact_phone) VALUES($1,'Favorites owner','+85512345678')",
        [owner],
      );
      await db.query(
        "INSERT INTO properties(id,landlord_id,name,address_line,latitude,longitude,total_units) VALUES($1,$2,'Private property','PRIVATE ADDRESS',11.57,104.89,3)",
        [property, owner],
      );
      for (const id of listingIds) {
        await db.query(
          "INSERT INTO listings(id,property_id,landlord_id,slug,title_en,property_type,monthly_price,currency,available_units,status,published_at,availability_confirmed_at,moderation_note) VALUES($1,$2,$3,$4,'Saved room','room',125,'USD',1,'published',now(),now(),'PRIVATE NOTE')",
          [id, property, owner, `favorite-${id}`],
        );
      }
      await db.query(
        "INSERT INTO amenities(id,key,name_km,name_en) VALUES($1,$2,'វ៉ាយហ្វាយ','Wi-Fi')",
        [amenity, `favorite-${amenity}`],
      );
      await db.query(
        "INSERT INTO listing_amenities(listing_id,amenity_id) VALUES($1,$2)",
        [listingIds[0], amenity],
      );
      for (const [order, status] of [
        [0, "uploading"],
        [1, "ready"],
        [2, "failed"],
      ])
        await db.query(
          "INSERT INTO listing_images(listing_id,storage_key,public_url,sort_order,status) VALUES($1,$2,$3,$4,$5::image_status)",
          [
            listingIds[0],
            `PRIVATE-${listingIds[0]}-${order}`,
            `https://cdn.example.test/${status}.jpg`,
            order,
            status,
          ],
        );
      const a = await token(students[0]);
      const b = await token(students[1]);
      // Token claims deliberately say STUDENT; current database role wins.
      for (const method of ["GET", "PUT", "DELETE"]) {
        const path = method === "GET" ? "" : `/${listingIds[0]}`;
        assert.equal((await request(method, path)).response.status, 401);
        for (const id of [owner, admin, unfinished])
          assert.equal(
            (await request(method, path, await token(id))).response.status,
            403,
          );
      }
      for (const query of [
        "?page=0",
        "?page=10001",
        "?page=1&page=2",
        "?pageSize=51",
        "?pageSize=1&pageSize=1",
        "?listingIds=bad",
        `?listingIds=${listingIds[0]},${listingIds[0]}`,
        `?listingIds=${listingIds[0]}&listingIds=${listingIds[1]}`,
        `?studentId=${students[1]}`,
        `?listingIds=${Array.from({ length: 51 }, randomUUID).join(",")}`,
      ])
        assert.equal(
          (await request("GET", query, a)).response.status,
          400,
          query,
        );
      assert.equal((await request("PUT", "/invalid", a)).response.status, 400);
      assert.equal(
        (
          await request("PUT", `/${listingIds[0]}`, a, {
            studentId: students[1],
            saved: true,
          })
        ).response.status,
        400,
      );
      assert.equal(
        (
          await request("DELETE", `/${listingIds[0]}`, a, {
            studentId: students[1],
          })
        ).response.status,
        400,
      );
      assert.equal(
        (await request("PUT", `/${randomUUID()}`, a)).response.status,
        404,
      );
      const saves = await Promise.all(
        Array.from({ length: 6 }, () =>
          request("PUT", `/${listingIds[0]}`, a, {}),
        ),
      );
      for (const saved of saves) {
        assert.equal(saved.response.status, 200, JSON.stringify(saved.payload));
        assert.deepEqual(saved.payload.data, {
          listingId: listingIds[0],
          saved: true,
        });
      }
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int FROM favorites WHERE student_id=$1",
            [students[0]],
          )
        ).rows[0].count,
        1,
      );
      const initial = await request("GET", "", a);
      assert.equal(
        initial.response.headers.get("cache-control"),
        "private, no-store",
      );
      assert.equal(initial.payload.meta.total, 1);
      assert.equal(
        initial.payload.data[0].listing.primaryImage.publicUrl,
        "https://cdn.example.test/ready.jpg",
      );
      assert.equal(
        initial.payload.data[0].listing.amenities[0].nameEn,
        "Wi-Fi",
      );
      const serialized = JSON.stringify(initial.payload);
      for (const hidden of [
        "PRIVATE",
        owner,
        students[0],
        "storageKey",
        "moderationNote",
        "studentId",
        "landlordId",
        "password",
        "addressLine",
      ])
        assert.equal(serialized.includes(hidden), false, hidden);
      const savedAt = initial.payload.data[0].savedAt;
      await request("PUT", `/${listingIds[0]}`, a);
      assert.equal(
        (await request("GET", "", a)).payload.data[0].savedAt,
        savedAt,
      );
      assert.equal((await request("GET", "", b)).payload.meta.total, 0);
      assert.equal(
        (await request("DELETE", `/${listingIds[0]}`, b)).response.status,
        200,
      );
      assert.equal((await request("GET", "", a)).payload.meta.total, 1);
      await db.query(
        "UPDATE listings SET available_from='2099-01-01' WHERE id=$1",
        [listingIds[1]],
      );
      assert.equal(
        (await request("PUT", `/${listingIds[1]}`, a)).response.status,
        200,
      );
      const page1 = await request("GET", "?pageSize=1", a);
      const page2 = await request("GET", "?page=2&pageSize=1", a);
      assert.equal(page1.payload.meta.totalPages, 2);
      assert.notEqual(
        page1.payload.data[0].listingId,
        page2.payload.data[0].listingId,
      );
      assert.equal(
        (await request("GET", `?listingIds=${listingIds[0]}`, a)).payload.meta
          .total,
        1,
      );
      for (const status of [
        "draft",
        "pending_review",
        "paused",
        "rented",
        "rejected",
        "archived",
      ]) {
        await db.query(
          "UPDATE listings SET status=$1::listing_status WHERE id=ANY($2::uuid[])",
          [status, [listingIds[0], listingIds[2]]],
        );
        assert.equal(
          (await request("PUT", `/${listingIds[2]}`, a)).payload.error.code,
          "LISTING_NOT_FOUND",
          status,
        );
        assert.equal(
          (await request("PUT", `/${listingIds[0]}`, a)).response.status,
          200,
          status,
        );
        assert.equal(
          (await request("GET", `?listingIds=${listingIds[0]}`, a)).payload
            .data[0].listing,
          null,
          status,
        );
      }
      await db.query(
        "UPDATE listings SET status='published' WHERE id=ANY($1::uuid[])",
        [listingIds],
      );
      for (const [hide, restore, args] of [
        [
          "UPDATE listings SET available_units=0 WHERE id=$1",
          "UPDATE listings SET available_units=1 WHERE id=$1",
          [listingIds[0]],
        ],
        [
          "UPDATE listings SET deleted_at=now() WHERE id=$1",
          "UPDATE listings SET deleted_at=null WHERE id=$1",
          [listingIds[0]],
        ],
        [
          "UPDATE properties SET deleted_at=now() WHERE id=$1",
          "UPDATE properties SET deleted_at=null WHERE id=$1",
          [property],
        ],
        [
          "UPDATE users SET account_status='suspended' WHERE id=$1",
          "UPDATE users SET account_status='active' WHERE id=$1",
          [owner],
        ],
      ]) {
        await db.query(hide, args);
        assert.equal(
          (await request("PUT", `/${listingIds[0]}`, b)).response.status,
          404,
        );
        assert.equal(
          (await request("GET", `?listingIds=${listingIds[0]}`, a)).payload
            .data[0].listing,
          null,
        );
        await db.query(restore, args);
      }
      await db.query(
        "UPDATE users SET account_status='suspended' WHERE id=$1",
        [students[0]],
      );
      for (const method of ["GET", "PUT", "DELETE"])
        assert.equal(
          (
            await request(
              method,
              method === "GET" ? "" : `/${listingIds[0]}`,
              a,
            )
          ).response.status,
          401,
        );
      await db.query("UPDATE users SET account_status='active' WHERE id=$1", [
        students[0],
      ]);
      await db.query("UPDATE listings SET status='paused' WHERE id=$1", [
        listingIds[0],
      ]);
      for (let i = 0; i < 2; i++)
        assert.deepEqual(
          (await request("DELETE", `/${listingIds[0]}`, a)).payload.data,
          { listingId: listingIds[0], saved: false },
        );
      await request("DELETE", `/${listingIds[1]}`, a);
      assert.deepEqual((await request("GET", "", a)).payload, {
        data: [],
        meta: { page: 1, pageSize: 12, total: 0, totalPages: 0 },
      });
      const indexes = await db.query(
        "SELECT indexdef FROM pg_indexes WHERE indexname='favorites_student_id_created_at_listing_id_idx'",
      );
      assert.match(
        indexes.rows[0].indexdef,
        /student_id, created_at DESC, listing_id/,
      );
    } finally {
      server.kill("SIGTERM");
      await db.query("DELETE FROM listings WHERE id=ANY($1::uuid[])", [
        listingIds,
      ]);
      await db.query("DELETE FROM properties WHERE id=$1", [property]);
      await db.query("DELETE FROM amenities WHERE id=$1", [amenity]);
      await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [
        [...students, owner, admin, unfinished],
      ]);
      await db.end();
      await new Promise((resolve) => {
        if (server.exitCode !== null || server.signalCode !== null) resolve();
        else server.once("exit", resolve);
      });
    }
  },
);
