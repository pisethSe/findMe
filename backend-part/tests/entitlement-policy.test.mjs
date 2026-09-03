import assert from "node:assert/strict";
import test from "node:test";

import { evaluateEntitlement } from "../dist/modules/entitlements/entitlement-policy.js";
import { EntitlementsService } from "../dist/modules/entitlements/entitlements.service.js";

const now = new Date("2026-09-03T00:00:00.000Z");

test("grants restricted supply capabilities only inside a server-evaluated access window", () => {
  const active = evaluateEntitlement(
    {
      status: "TRIALING",
      source: "TRIAL",
      trialStartedAt: now,
      trialEndsAt: new Date("2026-09-10T00:00:00.000Z"),
      accessEndsAt: new Date("2026-09-10T00:00:00.000Z"),
    },
    now,
  );

  assert.equal(active.isAccessActive, true);
  assert.equal(active.remainingDays, 7);
  assert.equal(active.capabilities.canCreateListings, true);
  assert.equal(active.capabilities.canPublishListings, true);
  assert.equal(active.capabilities.canIncreaseAvailability, true);
  assert.equal(active.capabilities.canReadListings, true);

  const atExpiry = evaluateEntitlement(
    {
      status: "TRIALING",
      source: "TRIAL",
      trialStartedAt: new Date("2026-08-27T00:00:00.000Z"),
      trialEndsAt: now,
      accessEndsAt: now,
    },
    now,
  );

  assert.equal(atExpiry.isAccessActive, false);
  assert.equal(atExpiry.remainingDays, null);
  assert.equal(atExpiry.capabilities.canCreateListings, false);
  assert.equal(atExpiry.capabilities.canSubmitListings, false);
  assert.equal(atExpiry.capabilities.canPublishListings, false);
  assert.equal(atExpiry.capabilities.canIncreaseAvailability, false);
  assert.equal(atExpiry.capabilities.canReadListings, true);
});

test("allows an open-ended active grant and denies expired supply writes", async () => {
  const openEnded = evaluateEntitlement(
    {
      status: "ACTIVE",
      source: "ADMIN_GRANT",
      trialStartedAt: null,
      trialEndsAt: null,
      accessEndsAt: null,
    },
    now,
  );
  assert.equal(openEnded.isAccessActive, true);
  assert.equal(openEnded.remainingDays, null);

  const service = new EntitlementsService({
    findCurrent: async () => ({
      landlordId: "00000000-0000-4000-8000-000000000201",
      status: "EXPIRED",
      source: "TRIAL",
      trialStartedAt: new Date("2026-08-20T00:00:00.000Z"),
      trialEndsAt: new Date("2026-08-27T00:00:00.000Z"),
      accessEndsAt: new Date("2026-08-27T00:00:00.000Z"),
    }),
  });

  await assert.rejects(
    service.assertRestrictedSupplyActionAllowed(
      "00000000-0000-4000-8000-000000000201",
      "CREATE_LISTING",
    ),
    (error) => error.getResponse().code === "LANDLORD_ENTITLEMENT_REQUIRED",
  );
});
