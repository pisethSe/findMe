import assert from "node:assert/strict";
import { DiscoveryRepository } from "../../dist/modules/discovery/discovery.repository.js";

// Capture the SQL at the Prisma boundary, then execute it with its original
// bound parameters on the test transaction. No parallel copy of search SQL.
export async function captureSearchQueries(input) {
  const queries = [];
  const repository = new DiscoveryRepository({
    $queryRaw: (query) => {
      queries.push(query);
      return Promise.resolve([]);
    },
    $transaction: (reads) => Promise.all(reads),
  });
  await repository.search(input);
  assert.equal(
    queries.length,
    2,
    "Search has a bounded page/count query pair.",
  );
  return queries;
}

export function planNodes(plan) {
  return [plan, ...(plan.Plans ?? []).flatMap(planNodes)];
}
