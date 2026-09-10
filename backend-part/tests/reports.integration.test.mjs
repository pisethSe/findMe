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
  "reports validate inputs, protect private targets, deduplicate and survive Redis outage",
  { skip: !testDatabaseUrl, timeout: 45000 },
  async () => {
    const db = new pg.Client({ connectionString: testDatabaseUrl });
    const base = "http://127.0.0.1:32187/api/v1";
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
        PORT: "32187",
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
      const a = await token(students[0]);
      const endpoint = `/listings/${listingIds[0]}/reports`;
      assert.equal(
        (await api("POST", endpoint, undefined, newInput())).response.status,
        401,
      );
      for (const bad of [
        {},
        { reason: "FAKE" },
        { reason: "OTHER", details: null },
        { reason: "OTHER", details: 3 },
        { reason: "OTHER", details: "x".repeat(2001) },
        { ...newInput(), reporterId: students[1] },
        { ...newInput(), status: "RESOLVED" },
        { ...newInput(), resolutionNote: "Override" },
      ])
        assert.equal(
          (await api("POST", endpoint, a, bad)).response.status,
          400,
        );
      assert.equal(
        (await api("POST", "/listings/bad/reports", a, newInput())).response
          .status,
        400,
      );
      assert.equal(
        (await api("POST", `/listings/${randomUUID()}/reports`, a, newInput()))
          .response.status,
        404,
      );
      await db.query("UPDATE listings SET status='draft' WHERE id=$1", [
        listingIds[11],
      ]);
      assert.equal(
        (
          await api(
            "POST",
            `/listings/${listingIds[11]}/reports`,
            a,
            newInput(),
          )
        ).response.status,
        404,
      );
      const receipts = await Promise.all(
        Array.from({ length: 3 }, () => api("POST", endpoint, a, newInput())),
      );
      for (const receipt of receipts) {
        assert.equal(receipt.response.status, 201);
        assert.equal(receipt.body.data.received, true);
        assert.deepEqual(Object.keys(receipt.body.data).sort(), [
          "id",
          "received",
        ]);
        assert.equal(receipt.body.data.id, receipts[0].body.data.id);
        assert.match(
          receipt.response.headers.get("cache-control"),
          /private, no-store/,
        );
      }
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM reports WHERE reporter_id=$1",
            [students[0]],
          )
        ).rows[0].n,
        1,
      );
      await db.query("UPDATE listings SET status='paused' WHERE id=$1", [
        listingIds[0],
      ]);
      assert.equal(
        (await api("POST", endpoint, a, newInput())).body.data.id,
        receipts[0].body.data.id,
      );
      // All authenticated active user roles can report; inventory need not be available.
      await db.query("UPDATE listings SET available_units=0 WHERE id=$1", [
        listingIds[1],
      ]);
      for (const id of [owners[0], admin, unfinished])
        assert.equal(
          (
            await api(
              "POST",
              `/listings/${listingIds[1]}/reports`,
              await token(id),
              { reason: "UNAVAILABLE" },
            )
          ).response.status,
          201,
        );
      for (let i = 1; i < 10; i++)
        assert.equal(
          (
            await api(
              "POST",
              `/listings/${listingIds[i]}/reports`,
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
            `/listings/${listingIds[10]}/reports`,
            a,
            newInput(),
          )
        ).response.status,
        429,
      );
      await db.query(
        "UPDATE users SET account_status='suspended' WHERE id=$1",
        [students[0]],
      );
      assert.equal(
        (await api("POST", endpoint, a, newInput())).response.status,
        401,
      );
    } finally {
      server.kill("SIGTERM");
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
