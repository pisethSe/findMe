import assert from "node:assert/strict";
import test from "node:test";
import { config as loadEnvironment } from "dotenv";
import pg from "pg";
import {
  seedSearchFixture,
  searchScenarios,
} from "./performance/search-fixture.mjs";
import {
  captureSearchQueries,
  planNodes,
} from "./performance/search-queries.mjs";

loadEnvironment({
  path: new URL("../../.env", import.meta.url).pathname,
  quiet: true,
});
const url = process.env.TEST_DATABASE_URL;

test(
  "large spatial searches hydrate only the page and preserve exact totals and ordering",
  { skip: !url, timeout: 120000 },
  async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    try {
      const fixture = await seedSearchFixture(client);
      for (const { name, input } of searchScenarios(fixture)) {
        // Other integration suites may commit inventory concurrently. Scope this
        // fixture with a unique amenity without changing production SQL.
        input.amenities = [
          ...new Set([fixture.amenityKeys[0], ...input.amenities]),
        ];
        const [pageQuery, countQuery] = await captureSearchQueries(input);
        const explanation = await client.query(
          `EXPLAIN (ANALYZE, FORMAT JSON) ${pageQuery.text}`,
          pageQuery.values,
        );
        const nodes = planNodes(explanation.rows[0]["QUERY PLAN"][0].Plan);
        // Assert bounded work, not unstable timings or the planner's whole tree.
        const photos = nodes.filter(
          (node) => node["Relation Name"] === "listing_images",
        );
        assert.ok(photos.length > 0);
        for (const node of photos)
          assert.ok(
            node["Actual Loops"] <= input.pageSize,
            `${name}: photo work must follow pagination`,
          );
        const page = (await client.query(pageQuery.text, pageQuery.values))
          .rows;
        const hydration = nodes.filter(
          (node) =>
            node["Relation Name"] === "listing_images" ||
            node.Alias === "page_amenities",
        );
        for (const node of hydration) {
          assert.ok(
            node["Actual Loops"] <= page.length,
            `${name}: hydrate only returned cards`,
          );
        }
        const count = Number(
          (await client.query(countQuery.text, countQuery.values)).rows[0]
            .total,
        );
        assert.ok(
          count > 0,
          `${name}: fixture must exercise matching inventory`,
        );
        assert.equal(page.length, name === "empty-page" ? 0 : input.pageSize);
        assert.equal(new Set(page.map((row) => row.id)).size, page.length);
        for (const row of page) {
          assert.equal(
            row.primaryImageSortOrder,
            1,
            "Skip the first uploading image.",
          );
          assert.equal(row.amenities.length, 4);
          assert.ok(row.distanceMeters <= input.radiusMeters);
        }
        // Every sort's later page must be the same slice of the larger first page,
        // including equal prices/publication dates with distance + ID tie-breaks.
        if (name !== "empty-page") {
          const [firstQuery] = await captureSearchQueries({
            ...input,
            page: 1,
            pageSize: 50,
          });
          const first = (await client.query(firstQuery.text, firstQuery.values))
            .rows;
          const [nextQuery, nextCount] = await captureSearchQueries({
            ...input,
            page: 2,
            pageSize: 20,
          });
          const next = (await client.query(nextQuery.text, nextQuery.values))
            .rows;
          assert.deepEqual(
            next,
            first.slice(20, 40),
            `${name}: stable second page`,
          );
          assert.equal(
            Number(
              (await client.query(nextCount.text, nextCount.values)).rows[0]
                .total,
            ),
            count,
          );
        }
      }
      const index =
        await client.query(`SELECT indisvalid, pg_get_expr(indpred, indrelid) AS predicate
      FROM pg_index WHERE indexrelid = 'listings_public_search_property_idx'::regclass`);
      assert.equal(index.rows[0].indisvalid, true);
      assert.match(index.rows[0].predicate, /published/);
      assert.match(index.rows[0].predicate, /available_units > 0/);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  },
);
