import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { assertReportTransition } from "../dist/modules/admin/admin.repository.js";
import { AdminService } from "../dist/modules/admin/admin.service.js";
test("report decisions reject stale state and terminal rewrites", () => {
  for (const current of ["OPEN", "IN_REVIEW"])
    for (const next of ["IN_REVIEW", "RESOLVED", "DISMISSED"])
      assert.doesNotThrow(() => assertReportTransition(current, current, next));
  for (const args of [
    ["OPEN", "IN_REVIEW", "RESOLVED"],
    ["RESOLVED", "RESOLVED", "IN_REVIEW"],
    ["DISMISSED", "DISMISSED", "RESOLVED"],
    ["OPEN", "OPEN", "OPEN"],
  ])
    assert.throws(
      () => assertReportTransition(...args),
      (error) => error.getStatus() === 409,
    );
});
test("suspension cache invalidation happens only after commit", async () => {
  const order = [];
  const user = {
    id: "u",
    role: "LANDLORD",
    accountStatus: "SUSPENDED",
    createdAt: new Date(),
    landlordProfile: { displayName: "Owner" },
    studentProfile: null,
  };
  const service = new AdminService(
    {
      setUserStatus: async () => {
        order.push("commit");
        return { user, listings: [{ id: "l", slug: "rental" }] };
      },
    },
    { invalidatePublishedListings: async () => order.push("invalidate") },
  );
  await service.setUserStatus("a", "u", "SUSPENDED", "Reviewed abuse");
  assert.deepEqual(order, ["commit", "invalidate"]);
  const failure = new AdminService(
    {
      setUserStatus: async () => {
        throw new Error("rollback");
      },
    },
    {
      invalidatePublishedListings: async () =>
        assert.fail("must not invalidate"),
    },
  );
  await assert.rejects(
    failure.setUserStatus("a", "u", "SUSPENDED", "Reviewed abuse"),
  );
});
