import assert from "node:assert/strict";
import test from "node:test";

import { calculateRentalCost } from "../src/domain/rental-cost.ts";

test("calculates monthly and move-in totals without mixing currencies", () => {
  const result = calculateRentalCost({
    baseRent: { amountMinor: 6_000, currency: "USD" },
    deposit: { amountMinor: 6_000, currency: "USD" },
    recurringCharges: [
      {
        kind: "fixed",
        label: "Internet",
        amount: { amountMinor: 500, currency: "USD" },
      },
      {
        kind: "metered",
        label: "Electricity",
        rate: { amountMinor: 250_000, currency: "KHR" },
        estimatedUnits: 70,
        unitLabel: "kWh",
      },
    ],
  });

  assert.deepEqual(result.monthlyTotals, {
    USD: 6_500,
    KHR: 17_500_000,
  });
  assert.deepEqual(result.moveInTotals, {
    USD: 12_500,
    KHR: 17_500_000,
  });
  assert.equal(result.monthlyBreakdown[2]?.estimate, true);
  assert.equal(result.monthlyBreakdown[2]?.detail, "70 kWh");
});

test("rejects negative metered usage", () => {
  assert.throws(
    () =>
      calculateRentalCost({
        baseRent: { amountMinor: 10_000, currency: "USD" },
        recurringCharges: [
          {
            kind: "metered",
            label: "Electricity",
            rate: { amountMinor: 25_000, currency: "KHR" },
            estimatedUnits: -1,
            unitLabel: "kWh",
          },
        ],
      }),
    /Quantity must be a non-negative/,
  );
});
