import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import pg from "pg";
import { seedSearchFixture, searchScenarios } from "./search-fixture.mjs";

// Benchmark the actual parameterized repository SQL, including count, without
// the Redis cache or any third-party network. Fixtures are always rolled back.
let url;
try {
  url = new URL(process.env.TEST_DATABASE_URL ?? "");
} catch {
  throw new Error(
    "Set TEST_DATABASE_URL to the local disposable PostgreSQL test database.",
  );
}
assert.ok(
  ["postgres:", "postgresql:"].includes(url.protocol),
  "Use a PostgreSQL URL.",
);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
  "Use the local disposable test database.",
);
assert.ok(
  /test/i.test(url.pathname),
  "Use a database whose name contains test.",
);
// Validate explicitly provided configuration before app imports can load .env.
const { captureSearchQueries } = await import("./search-queries.mjs");
const client = new pg.Client({ connectionString: url.href });
const samples = 30;
const report = { fixture: null, samples, scenarios: [] };
await client.connect();
await client.query("BEGIN");
try {
  report.fixture = await seedSearchFixture(client);
  for (const { name, input } of searchScenarios(report.fixture)) {
    const queries = await captureSearchQueries(input);
    const plans = [];
    for (const query of queries) {
      const result = await client.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.text}`,
        query.values,
      );
      plans.push(result.rows[0]["QUERY PLAN"][0]);
    }
    const durations = [];
    let rows = [];
    for (let warmup = 0; warmup < 3; warmup++) {
      for (const query of queries) await client.query(query.text, query.values);
    }
    for (let run = 0; run < samples; run++) {
      const start = performance.now();
      for (const query of queries)
        rows = (await client.query(query.text, query.values)).rows;
      durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    const result = {
      name,
      total: Number(rows[0]?.total ?? 0),
      p50Ms: durations[Math.ceil(samples * 0.5) - 1],
      p95Ms: durations[Math.ceil(samples * 0.95) - 1],
      plans,
    };
    report.scenarios.push(result);
    console.log(
      `${name}: p50=${result.p50Ms.toFixed(1)}ms p95=${result.p95Ms.toFixed(1)}ms total=${result.total}`,
    );
  }
  if (process.argv[2])
    await writeFile(process.argv[2], JSON.stringify(report, null, 2));
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
