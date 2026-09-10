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
  "inquiry submission, private histories, retry keys, statuses and outage-safe limits",
  { skip: !testDatabaseUrl, timeout: 45000 },
  async () => {
    const db = new pg.Client({ connectionString: testDatabaseUrl });
    const base = "http://127.0.0.1:32186/api/v1";
    const secret = "inquiry-test-access-secret-at-least-32-characters";
    const students = [randomUUID(), randomUUID()];
    const owners = [randomUUID(), randomUUID()];
    const admin = randomUUID();
    const unfinished = randomUUID();
    const property = randomUUID();
    const listingIds = Array.from({ length: 12 }, () => randomUUID());
    const server = spawn(process.execPath, ["dist/main.js"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        APP_ENV: "test",
        PORT: "32186",
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
      message: "Can I visit this room? Please reply on Telegram @student_test.",
      clientRequestId: randomUUID(),
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
      const a = await token(students[0]);
      const b = await token(students[1]);
      const owner = await token(owners[0]);
      const otherOwner = await token(owners[1]);
      const endpoint = `/listings/${listingIds[0]}/inquiries`;
      assert.equal(
        (await api("POST", endpoint, undefined, newInput())).response.status,
        401,
      );
      for (const id of [owners[0], admin, unfinished])
        assert.equal(
          (await api("POST", endpoint, await token(id), newInput())).response
            .status,
          403,
        );
      for (const bad of [
        { message: "", clientRequestId: randomUUID() },
        { message: " \n\t", clientRequestId: randomUUID() },
        { message: "x".repeat(2001), clientRequestId: randomUUID() },
        { message: 22, clientRequestId: randomUUID() },
        { message: "Valid", clientRequestId: "bad" },
        { message: "Valid" },
        { ...newInput(), landlordId: owners[1] },
        { ...newInput(), studentId: students[1] },
        { ...newInput(), status: "READ" },
      ])
        assert.equal(
          (await api("POST", endpoint, a, bad)).response.status,
          400,
        );
      assert.equal(
        (await api("POST", "/listings/bad/inquiries", a, newInput())).response
          .status,
        400,
      );
      assert.equal(
        (
          await api(
            "POST",
            `/listings/${randomUUID()}/inquiries`,
            a,
            newInput(),
          )
        ).body.error.code,
        "LISTING_NOT_FOUND",
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
          "UPDATE listings SET status=$1::listing_status WHERE id=$2",
          [status, listingIds[0]],
        );
        assert.equal(
          (await api("POST", endpoint, a, newInput())).body.error.code,
          "LISTING_NOT_FOUND",
          status,
        );
        if (status === "pending_review") {
          const queue = await api(
            "GET",
            "/admin/listings/pending?pageSize=50",
            await token(admin),
          );
          assert.equal(queue.response.status, 200, JSON.stringify(queue.body));
          assert.ok(
            queue.body.data.some((listing) => listing.id === listingIds[0]),
          );
        }
      }
      await db.query("UPDATE listings SET status='published' WHERE id=$1", [
        listingIds[0],
      ]);
      for (const [hide, restore, id] of [
        [
          "UPDATE listings SET available_units=0 WHERE id=$1",
          "UPDATE listings SET available_units=1 WHERE id=$1",
          listingIds[0],
        ],
        [
          "UPDATE listings SET deleted_at=now() WHERE id=$1",
          "UPDATE listings SET deleted_at=null WHERE id=$1",
          listingIds[0],
        ],
        [
          "UPDATE properties SET deleted_at=now() WHERE id=$1",
          "UPDATE properties SET deleted_at=null WHERE id=$1",
          property,
        ],
        [
          "UPDATE users SET account_status='suspended' WHERE id=$1",
          "UPDATE users SET account_status='active' WHERE id=$1",
          owners[0],
        ],
      ]) {
        await db.query(hide, [id]);
        assert.equal(
          (await api("POST", endpoint, a, newInput())).body.error.code,
          "LISTING_NOT_FOUND",
        );
        await db.query(restore, [id]);
      }
      const input = {
        ...newInput(),
        message: "  <script>untrusted inquiry</script> បន្ទប់ទំនេរទេ?  ",
      };
      const requests = await Promise.all(
        Array.from({ length: 5 }, () => api("POST", endpoint, a, input)),
      );
      for (const result of requests)
        assert.equal(result.response.status, 201, JSON.stringify(result.body));
      const inquiry = requests[0].body.data;
      for (const result of requests) {
        assert.equal(result.body.data.id, inquiry.id);
        assert.equal(result.body.data.message, input.message.trim());
        assert.equal(result.body.data.createdAt, inquiry.createdAt);
      }
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int FROM inquiries WHERE student_id=$1",
            [students[0]],
          )
        ).rows[0].count,
        1,
      );
      assert.equal(
        (await api("POST", endpoint, a, { ...input, message: "Changed" })).body
          .error.code,
        "INQUIRY_REQUEST_CONFLICT",
      );
      assert.equal(
        (await api("POST", `/listings/${listingIds[1]}/inquiries`, a, input))
          .response.status,
        409,
      );
      assert.equal(
        (await api("POST", endpoint, a, newInput())).body.error.code,
        "INQUIRY_RATE_LIMITED",
      );
      assert.equal(
        (await api("POST", endpoint, b, input)).response.status,
        201,
      ); // request keys scoped per student
      const studentFeed = await api("GET", "/me/inquiries", a);
      assert.equal(
        studentFeed.response.headers.get("cache-control"),
        "private, no-store",
      );
      assert.equal(studentFeed.body.meta.total, 1);
      const landlordFeed = await api("GET", "/landlord/inquiries", owner);
      assert.equal(landlordFeed.body.meta.total, 2);
      assert.equal(landlordFeed.body.meta.pageSize, 5);
      assert.equal(
        landlordFeed.response.headers.get("cache-control"),
        "private, no-store",
      );
      assert.equal(
        (await api("GET", "/landlord/inquiries", otherOwner)).body.meta.total,
        0,
      );
      for (const route of ["/me/inquiries", "/landlord/inquiries"]) {
        assert.equal((await api("GET", route)).response.status, 401);
        assert.equal(
          (await api("GET", route, route === "/me/inquiries" ? owner : a))
            .response.status,
          403,
        );
        for (const query of [
          "?page=0",
          "?page=10001",
          "?page=1&page=1",
          "?pageSize=51",
          "?pageSize=1&pageSize=2",
          "?studentId=bad",
        ])
          assert.equal(
            (
              await api(
                "GET",
                route + query,
                route === "/me/inquiries" ? a : owner,
              )
            ).response.status,
            400,
          );
      }
      for (const serialized of [
        JSON.stringify(studentFeed.body),
        JSON.stringify(landlordFeed.body),
      ])
        for (const secretValue of [
          "PRIVATE",
          "clientRequestId",
          "studentId",
          "landlordId",
          "password",
          "@example.test",
          "moderationNote",
        ])
          assert.equal(serialized.includes(secretValue), false, secretValue);
      const statusPath = `/landlord/inquiries/${inquiry.id}/status`;
      assert.equal(
        (await api("PATCH", statusPath, otherOwner, { status: "READ" }))
          .response.status,
        404,
      );
      assert.equal(
        (await api("PATCH", statusPath, a, { status: "READ" })).response.status,
        403,
      );
      assert.equal(
        (await api("PATCH", statusPath, owner, { status: "NEW" })).response
          .status,
        400,
      );
      assert.equal(
        (
          await api("PATCH", statusPath, owner, {
            status: "READ",
            studentId: students[0],
          })
        ).response.status,
        400,
      );
      // Historical inquiries remain manageable with expired access and withdrawn supply.
      await db.query(
        "INSERT INTO landlord_entitlements(landlord_id,status,source,trial_started_at,trial_ends_at,access_ends_at) VALUES($1,'expired','trial',now()-interval '8 days',now()-interval '1 day',now()-interval '1 day')",
        [owners[0]],
      );
      await db.query("UPDATE listings SET status='paused' WHERE id=$1", [
        listingIds[0],
      ]);
      assert.equal(
        (await api("GET", "/me/inquiries", a)).body.data[0].listing,
        null,
      );
      assert.equal(
        (await api("POST", endpoint, a, input)).body.data.id,
        inquiry.id,
      );
      assert.equal(
        (await api("POST", endpoint, a, input)).body.data.listing,
        null,
      );
      for (const status of ["READ", "RESPONDED", "CLOSED"]) {
        const result = await api("PATCH", statusPath, owner, { status });
        assert.equal(result.response.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.data.status, status);
        const again = await api("PATCH", statusPath, owner, { status });
        assert.equal(again.body.data.updatedAt, result.body.data.updatedAt);
      }
      assert.equal(
        (await api("PATCH", statusPath, owner, { status: "READ" })).body.error
          .code,
        "INQUIRY_STATUS_CONFLICT",
      );
      const timestamps = (
        await db.query(
          "SELECT read_at,responded_at,closed_at FROM inquiries WHERE id=$1",
          [inquiry.id],
        )
      ).rows[0];
      assert.ok(
        timestamps.read_at && timestamps.responded_at && timestamps.closed_at,
      );
      assert.equal(
        (await api("GET", "/me/inquiries", a)).body.data[0].status,
        "CLOSED",
      );
      // Rate protection stays correct with Redis unavailable and multiple concurrent sends.
      for (let i = 1; i < 10; i++)
        assert.equal(
          (
            await api(
              "POST",
              `/listings/${listingIds[i]}/inquiries`,
              a,
              newInput(),
            )
          ).response.status,
          201,
        );
      assert.equal(
        (
          await api(
            "POST",
            `/listings/${listingIds[10]}/inquiries`,
            a,
            newInput(),
          )
        ).response.status,
        429,
      );
      const page1 = await api("GET", "/me/inquiries?pageSize=3", a);
      const page2 = await api("GET", "/me/inquiries?page=2&pageSize=3", a);
      assert.equal(page1.body.meta.total, 10);
      assert.equal(page1.body.meta.totalPages, 4);
      assert.equal(
        page1.body.data.some((x) => page2.body.data.some((y) => x.id === y.id)),
        false,
      );
      await db.query(
        "UPDATE inquiries SET created_at=now()-interval '61 minutes' WHERE student_id=$1",
        [students[0]],
      );
      const racing = await Promise.all(
        Array.from({ length: 5 }, () =>
          api("POST", `/listings/${listingIds[10]}/inquiries`, a, newInput()),
        ),
      );
      assert.equal(racing.filter((r) => r.response.status === 201).length, 1);
      assert.equal(racing.filter((r) => r.response.status === 429).length, 4);
      await db.query(
        "UPDATE users SET account_status='suspended' WHERE id=ANY($1::uuid[])",
        [[students[0], owners[0]]],
      );
      assert.equal(
        (
          await api(
            "POST",
            `/listings/${listingIds[11]}/inquiries`,
            a,
            newInput(),
          )
        ).response.status,
        401,
      );
      assert.equal((await api("GET", "/me/inquiries", a)).response.status, 401);
      assert.equal(
        (await api("PATCH", statusPath, owner, { status: "CLOSED" })).response
          .status,
        401,
      );
    } finally {
      server.kill("SIGTERM");
      await db.query("DELETE FROM inquiries WHERE listing_id=ANY($1::uuid[])", [
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
