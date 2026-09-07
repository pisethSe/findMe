import "reflect-metadata";

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { config as loadEnvironment } from "dotenv";
import pg from "pg";

import {
  PublicListingDetailQueryDto,
  PublicListingSlugDto,
} from "../dist/modules/discovery/dto/public-listing-detail.dto.js";

loadEnvironment({
  path: new URL("../../.env", import.meta.url).pathname,
  quiet: true,
});
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("public detail DTOs reject malformed slugs and ambiguous institutions", () => {
  for (const slug of ["room-near-rupp", "room-123"])
    assert.deepEqual(
      validateSync(plainToInstance(PublicListingSlugDto, { slug })),
      [],
    );
  for (const slug of [
    "",
    "../private",
    "bad slug",
    "a".repeat(181),
    ["room", "other"],
  ])
    assert.ok(
      validateSync(plainToInstance(PublicListingSlugDto, { slug })).length,
    );
  for (const institutionId of ["invalid", "", [randomUUID(), randomUUID()]])
    assert.ok(
      validateSync(
        plainToInstance(PublicListingDetailQueryDto, { institutionId }),
      ).length,
    );
});

test(
  "public rental detail enforces visibility, photo readiness, contact privacy and real PostGIS distance",
  { skip: !testDatabaseUrl, timeout: 35_000 },
  async () => {
    const db = new pg.Client({ connectionString: testDatabaseUrl });
    const ownerId = randomUUID(),
      propertyId = randomUUID(),
      listingId = randomUUID(),
      institutionId = randomUUID();
    const amenityId = randomUUID(),
      inactiveAmenityId = randomUUID();
    const slug = `detail-${listingId}`;
    const base = "http://127.0.0.1:32184/api/v1";
    const server = spawn(process.execPath, ["dist/main.js"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        APP_ENV: "test",
        PORT: "32184",
        DATABASE_URL: testDatabaseUrl,
        REDIS_URL: "",
        WEB_ORIGIN: "http://localhost:3000",
        JWT_ACCESS_SECRET: "detail-test-access-secret-at-least-32-characters",
        REFRESH_TOKEN_SECRET:
          "detail-test-refresh-secret-at-least-32-characters",
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
    await db.connect();
    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (server.exitCode !== null) throw new Error(serverOutput);
        if (
          await fetch(`${base}/health/live`)
            .then((response) => response.ok)
            .catch(() => false)
        )
          break;
        if (attempt === 99) throw new Error("Detail test API did not start.");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await db.query(
        "INSERT INTO users(id,email,password_hash,role,onboarding_completed_at) VALUES($1,$2,'private-test-hash','landlord',now())",
        [ownerId, `${ownerId}@example.test`],
      );
      await db.query(
        "INSERT INTO landlord_profiles(user_id,display_name,contact_phone,contact_telegram) VALUES($1,'Test owner','+85512345678','@test_owner')",
        [ownerId],
      );
      await db.query(
        "INSERT INTO properties(id,landlord_id,name,address_line,latitude,longitude,total_units) VALUES($1,$2,'Test property','Test address',11.569,104.8914,2)",
        [propertyId, ownerId],
      );
      await db.query(
        "INSERT INTO institutions(id,slug,name_km,name_en,type,latitude,longitude) VALUES($1,$2,'សាលាសាកល្បង','Detail school','university',11.57,104.892)",
        [institutionId, `school-${institutionId}`],
      );
      await db.query(
        "INSERT INTO listings(id,property_id,landlord_id,slug,title_en,title_km,description_en,property_type,monthly_price,currency,deposit_amount,available_units,status,published_at,availability_confirmed_at,moderation_note) VALUES($1,$2,$3,$4,'Test room','បន្ទប់ជួល','<script>untrusted landlord text</script>','room',125,'USD',250,1,'published',now(),now(),'PRIVATE MODERATION NOTE')",
        [listingId, propertyId, ownerId, slug],
      );
      await db.query(
        "INSERT INTO amenities(id,key,name_km,name_en,is_active) VALUES($1,$2,'វ៉ាយហ្វាយ','Wi-Fi',true),($3,$4,'អសកម្ម','Inactive amenity',false)",
        [
          amenityId,
          `wifi-${amenityId}`,
          inactiveAmenityId,
          `inactive-${inactiveAmenityId}`,
        ],
      );
      await db.query(
        "INSERT INTO listing_amenities(listing_id,amenity_id) VALUES($1,$2),($1,$3)",
        [listingId, amenityId, inactiveAmenityId],
      );
      for (const [order, status] of [
        [0, "uploading"],
        [1, "ready"],
        [2, "failed"],
        [3, "ready"],
        [4, "removed"],
      ]) {
        await db.query(
          "INSERT INTO listing_images(listing_id,storage_key,public_url,sort_order,status,width,height) VALUES($1,$2,$3,$4,$5::image_status,800,600)",
          [
            listingId,
            `${listingId}/private-key-${order}`,
            `https://cdn.example.test/photo-${order}.jpg`,
            order,
            status,
          ],
        );
      }
      const read = async (query = "") => {
        const response = await fetch(`${base}/listings/${slug}${query}`);
        return { response, payload: await response.json() };
      };
      let result = await read(`?institutionId=${institutionId}`);
      assert.equal(result.response.status, 200);
      assert.equal(result.response.headers.get("cache-control"), "no-store");
      assert.equal(result.payload.data.monthlyPrice, 125);
      assert.equal(result.payload.data.depositAmount, 250);
      assert.equal(result.payload.data.location.addressLine, "Test address");
      assert.equal(
        result.payload.data.descriptionEn,
        "<script>untrusted landlord text</script>",
      );
      assert.equal(result.payload.data.institution.id, institutionId);
      const {
        rows: [distance],
      } = await db.query(
        "SELECT round(ST_Distance(p.location,i.location)) AS meters FROM properties p CROSS JOIN institutions i WHERE p.id=$1 AND i.id=$2",
        [propertyId, institutionId],
      );
      assert.equal(result.payload.data.distanceMeters, Number(distance.meters));
      assert.deepEqual(
        result.payload.data.images.map((image) => image.sortOrder),
        [1, 3],
      );
      assert.deepEqual(
        result.payload.data.amenities.map((amenity) => amenity.id),
        [amenityId],
      );
      assert.deepEqual(result.payload.data.contact, {
        preference: "IN_APP_ONLY",
        displayName: "Test owner",
        phone: null,
        telegram: null,
      });
      const serialized = JSON.stringify(result.payload);
      for (const secret of [
        "PRIVATE MODERATION NOTE",
        "private-test-hash",
        "private-key",
        ownerId,
        "landlordId",
        "propertyId",
        "storageKey",
        "moderationNote",
        "email",
      ])
        assert.equal(serialized.includes(secret), false, secret);
      assert.deepEqual(
        Object.keys(result.payload.data.images[0]).sort(),
        [
          "id",
          "publicUrl",
          "altTextKm",
          "altTextEn",
          "width",
          "height",
          "sortOrder",
        ].sort(),
      );
      // Optional production-SSR smoke check against the same disposable DB.
      // Start the frontend and its API with that DB before setting this URL.
      if (process.env.TEST_FRONTEND_BASE_URL) {
        const web = await fetch(
          `${process.env.TEST_FRONTEND_BASE_URL}/rentals/${slug}`,
          { headers: { "User-Agent": "Googlebot" } },
        );
        const html = await web.text();
        assert.equal(web.status, 200);
        assert.match(html, /<title>Test room \| FindMe<\/title>/);
        assert.match(html, /name="description"/);
        assert.match(html, /property="og:title"/);
        assert.match(html, /name="twitter:card"/);
        assert.match(
          html,
          /&lt;script&gt;untrusted landlord text&lt;\/script&gt;/,
        );
        assert.equal(
          html.includes("<script>untrusted landlord text</script>"),
          false,
        );
        for (const secret of [
          "PRIVATE MODERATION NOTE",
          "private-test-hash",
          "private-key",
          ownerId,
        ])
          assert.equal(html.includes(secret), false);
      }
      result = await read();
      assert.equal(result.payload.data.distanceMeters, null);
      assert.equal(result.payload.data.institution, null);
      for (const [preference, phone, telegram] of [
        ["phone", "+85512345678", null],
        ["telegram", null, "@test_owner"],
        ["phone_or_telegram", "+85512345678", "@test_owner"],
      ]) {
        await db.query(
          "UPDATE listings SET contact_preference=$1::contact_preference WHERE id=$2",
          [preference, listingId],
        );
        result = await read();
        assert.equal(result.payload.data.contact.phone, phone);
        assert.equal(result.payload.data.contact.telegram, telegram);
      }
      for (const query of [
        "?institutionId=bad",
        `?institutionId=${institutionId}&institutionId=${institutionId}`,
      ])
        assert.equal((await read(query)).response.status, 400);
      result = await read(`?institutionId=${randomUUID()}`);
      assert.equal(result.response.status, 404);
      assert.equal(result.payload.error.code, "INSTITUTION_NOT_FOUND");
      await db.query("UPDATE institutions SET is_active=false WHERE id=$1", [
        institutionId,
      ]);
      assert.equal(
        (await read(`?institutionId=${institutionId}`)).response.status,
        404,
      );
      await db.query(
        "UPDATE listings SET available_from='2099-01-01' WHERE id=$1",
        [listingId],
      );
      assert.equal((await read()).payload.data.availableFrom, "2099-01-01");
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
          [status, listingId],
        );
        result = await read();
        assert.equal(result.response.status, 404, status);
        assert.equal(result.payload.error.code, "LISTING_NOT_FOUND", status);
        assert.equal("data" in result.payload, false);
      }
      await db.query(
        "UPDATE listings SET status='published',available_units=0 WHERE id=$1",
        [listingId],
      );
      assert.equal((await read()).response.status, 404);
      if (process.env.TEST_FRONTEND_BASE_URL) {
        const web = await fetch(
          `${process.env.TEST_FRONTEND_BASE_URL}/rentals/${slug}`,
          { headers: { "User-Agent": "Googlebot" } },
        );
        const html = await web.text();
        assert.match(html, /This rental is unavailable/);
        assert.match(html, /name="robots" content="[^"]*noindex/);
        assert.equal(html.includes("PRIVATE MODERATION NOTE"), false);
        assert.equal(html.includes('href="tel:'), false);
      }
      await db.query(
        "UPDATE listings SET available_units=1,deleted_at=now() WHERE id=$1",
        [listingId],
      );
      assert.equal((await read()).response.status, 404);
      await db.query("UPDATE listings SET deleted_at=null WHERE id=$1", [
        listingId,
      ]);
      await db.query("UPDATE properties SET deleted_at=now() WHERE id=$1", [
        propertyId,
      ]);
      assert.equal((await read()).response.status, 404);
      await db.query("UPDATE properties SET deleted_at=null WHERE id=$1", [
        propertyId,
      ]);
      await db.query(
        "UPDATE users SET account_status='suspended' WHERE id=$1",
        [ownerId],
      );
      assert.equal((await read()).response.status, 404);
      await db.query(
        "UPDATE users SET account_status='active',deleted_at=now() WHERE id=$1",
        [ownerId],
      );
      assert.equal((await read()).response.status, 404);
      assert.equal(
        (await fetch(`${base}/listings/missing-${randomUUID()}`)).status,
        404,
      );
    } finally {
      server.kill("SIGTERM");
      await db.query("DELETE FROM listings WHERE id=$1", [listingId]);
      await db.query("DELETE FROM properties WHERE id=$1", [propertyId]);
      await db.query("DELETE FROM users WHERE id=$1", [ownerId]);
      await db.query("DELETE FROM institutions WHERE id=$1", [institutionId]);
      await db.query("DELETE FROM amenities WHERE id=ANY($1::uuid[])", [
        [amenityId, inactiveAmenityId],
      ]);
      await db.end();
    }
  },
);
