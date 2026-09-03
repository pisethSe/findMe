import assert from "node:assert/strict";
import { config as loadEnvironment } from "dotenv";
import test from "node:test";

import pg from "pg";

loadEnvironment({
  path: new URL("../../.env", import.meta.url).pathname,
  quiet: true,
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

async function expectDatabaseRejection(
  client,
  sql,
  expectedConstraint,
  expectedCode = "23514",
) {
  await client.query("SAVEPOINT expected_rejection");
  let rejection;

  try {
    await client.query(sql);
  } catch (error) {
    rejection = error;
  }

  await client.query("ROLLBACK TO SAVEPOINT expected_rejection");
  assert.ok(rejection, "expected PostgreSQL to reject the operation");
  assert.equal(rejection.code, expectedCode);
  assert.equal(rejection.constraint, expectedConstraint);
}

test(
  "PostgreSQL enforces marketplace identity, ownership, capacity, and inquiry rules",
  { skip: !testDatabaseUrl },
  async () => {
    const client = new pg.Client({ connectionString: testDatabaseUrl });
    await client.connect();
    await client.query("BEGIN");

    try {
      await client.query(`
        INSERT INTO users (id, email, password_hash, role, onboarding_completed_at)
        VALUES
          ('00000000-0000-4000-8000-000000000001', 'student@example.test', 'argon2id-test-hash', 'student', CURRENT_TIMESTAMP),
          ('00000000-0000-4000-8000-000000000002', 'landlord@example.test', 'argon2id-test-hash', 'landlord', CURRENT_TIMESTAMP),
          ('00000000-0000-4000-8000-000000000003', 'other-landlord@example.test', 'argon2id-test-hash', 'landlord', CURRENT_TIMESTAMP),
          ('00000000-0000-4000-8000-000000000004', 'admin@example.test', 'argon2id-test-hash', 'admin', CURRENT_TIMESTAMP)
      `);

      await expectDatabaseRejection(
        client,
        `UPDATE users SET role = 'admin' WHERE id = '00000000-0000-4000-8000-000000000001'`,
        "users_role_immutable",
      );

      await client.query(`
        INSERT INTO student_profiles (user_id, display_name)
        VALUES ('00000000-0000-4000-8000-000000000001', 'Test Student')
      `);
      await expectDatabaseRejection(
        client,
        `INSERT INTO student_profiles (user_id, display_name)
         VALUES ('00000000-0000-4000-8000-000000000002', 'Not a Student')`,
        "student_profiles_student_role_trigger",
      );

      await client.query(`
        INSERT INTO landlord_entitlements (
          landlord_id, status, source, trial_started_at, trial_ends_at, access_ends_at
        ) VALUES (
          '00000000-0000-4000-8000-000000000002', 'trialing', 'trial',
          '2026-09-02T00:00:00Z', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z'
        )
      `);
      await expectDatabaseRejection(
        client,
        `UPDATE landlord_entitlements
         SET trial_ends_at = '2026-09-10T00:00:00Z', access_ends_at = '2026-09-10T00:00:00Z'
         WHERE landlord_id = '00000000-0000-4000-8000-000000000002'`,
        "landlord_trial_immutable",
      );
      await expectDatabaseRejection(
        client,
        `DELETE FROM landlord_entitlements
         WHERE landlord_id = '00000000-0000-4000-8000-000000000002'`,
        "landlord_entitlement_history_required",
      );

      await client.query(`
        INSERT INTO institutions (
          id, slug, name_km, name_en, type, latitude, longitude
        ) VALUES (
          '00000000-0000-4000-8000-000000000010', 'test-institution',
          'ស្ថាប័នសាកល្បង', 'Test Institution', 'university', 11.569000, 104.891400
        )
      `);
      await client.query(`
        INSERT INTO properties (
          id, landlord_id, name, address_line, latitude, longitude, total_units
        ) VALUES (
          '00000000-0000-4000-8000-000000000020',
          '00000000-0000-4000-8000-000000000002',
          'Test Property', 'Russian Federation Boulevard', 11.570000, 104.892000, 3
        )
      `);
      await client.query(`
        INSERT INTO listings (
          id, property_id, landlord_id, slug, title_en, property_type,
          monthly_price, currency, available_units
        ) VALUES (
          '00000000-0000-4000-8000-000000000030',
          '00000000-0000-4000-8000-000000000020',
          '00000000-0000-4000-8000-000000000002',
          'test-room', 'Test Room', 'room', 120, 'USD', 2
        )
      `);

      await expectDatabaseRejection(
        client,
        `INSERT INTO listings (
           property_id, landlord_id, slug, title_en, property_type,
           monthly_price, currency, available_units
         ) VALUES (
           '00000000-0000-4000-8000-000000000020',
           '00000000-0000-4000-8000-000000000003',
           'wrong-owner-room', 'Wrong Owner Room', 'room', 120, 'USD', 1
         )`,
        "listings_property_capacity",
      );

      await expectDatabaseRejection(
        client,
        `UPDATE listings SET available_units = 4
         WHERE id = '00000000-0000-4000-8000-000000000030'`,
        "listings_property_capacity",
      );
      await expectDatabaseRejection(
        client,
        `UPDATE properties SET total_units = 1
         WHERE id = '00000000-0000-4000-8000-000000000020'`,
        "properties_listing_capacity",
      );

      await client.query(`
        INSERT INTO favorites (student_id, listing_id)
        VALUES (
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000030'
        )
      `);
      await expectDatabaseRejection(
        client,
        `INSERT INTO favorites (student_id, listing_id)
         VALUES (
           '00000000-0000-4000-8000-000000000001',
           '00000000-0000-4000-8000-000000000030'
         )`,
        "favorites_pkey",
        "23505",
      );
      await expectDatabaseRejection(
        client,
        `INSERT INTO favorites (student_id, listing_id)
         VALUES (
           '00000000-0000-4000-8000-000000000002',
           '00000000-0000-4000-8000-000000000030'
         )`,
        "favorites_student_role_trigger",
      );

      await expectDatabaseRejection(
        client,
        `INSERT INTO inquiries (listing_id, student_id, landlord_id, message)
         VALUES (
           '00000000-0000-4000-8000-000000000030',
           '00000000-0000-4000-8000-000000000001',
           '00000000-0000-4000-8000-000000000002',
           'Is this room available?'
         )`,
        "inquiries_valid_listing",
      );

      await client.query(`
        UPDATE listings
        SET status = 'published', published_at = CURRENT_TIMESTAMP,
            availability_confirmed_at = CURRENT_TIMESTAMP
        WHERE id = '00000000-0000-4000-8000-000000000030'
      `);
      await client.query(`
        INSERT INTO inquiries (listing_id, student_id, landlord_id, message)
        VALUES (
          '00000000-0000-4000-8000-000000000030',
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002',
          'Is this room available?'
        )
      `);

      const geography = await client.query(`
        SELECT
          p.location IS NOT NULL AS property_location_generated,
          i.location IS NOT NULL AS institution_location_generated,
          ST_DWithin(p.location, i.location, 1000) AS within_one_kilometer
        FROM properties p
        CROSS JOIN institutions i
        WHERE p.id = '00000000-0000-4000-8000-000000000020'
          AND i.id = '00000000-0000-4000-8000-000000000010'
      `);
      assert.deepEqual(geography.rows[0], {
        property_location_generated: true,
        institution_location_generated: true,
        within_one_kilometer: true,
      });
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  },
);
