import {
  addToTotals,
  assertMoney,
  multiplyMoney,
  type Money,
  type TotalsByCurrency,
} from "./money.ts";

export interface FixedRecurringCharge {
  kind: "fixed";
  label: string;
  amount: Money;
}

export interface MeteredRecurringCharge {
  kind: "metered";
  label: string;
  rate: Money;
  estimatedUnits: number;
  unitLabel: string;
}

export type RecurringCharge = FixedRecurringCharge | MeteredRecurringCharge;

export interface RentalCostInput {
  baseRent: Money;
  deposit?: Money;
  recurringCharges: readonly RecurringCharge[];
}

export interface CalculatedCharge {
  label: string;
  amount: Money;
  estimate: boolean;
  detail?: string;
}

export interface RentalCostSummary {
  monthlyBreakdown: readonly CalculatedCharge[];
  monthlyTotals: TotalsByCurrency;
  moveInTotals: TotalsByCurrency;
}

/**
 * Calculates transparent recurring and move-in totals without silently
 * converting between USD and KHR.
 */
export function calculateRentalCost(input: RentalCostInput): RentalCostSummary {
  assertMoney(input.baseRent);

  const monthlyBreakdown: CalculatedCharge[] = [
    {
      label: "Base rent",
      amount: input.baseRent,
      estimate: false,
    },
  ];
  let monthlyTotals = addToTotals({}, input.baseRent);

  for (const charge of input.recurringCharges) {
    if (charge.label.trim().length === 0) {
      throw new TypeError("A recurring charge must have a label.");
    }

    const calculated =
      charge.kind === "fixed"
        ? {
            label: charge.label,
            amount: charge.amount,
            estimate: false,
          }
        : {
            label: charge.label,
            amount: multiplyMoney(charge.rate, charge.estimatedUnits),
            estimate: true,
            detail: `${charge.estimatedUnits} ${charge.unitLabel}`,
          };

    assertMoney(calculated.amount);
    monthlyBreakdown.push(calculated);
    monthlyTotals = addToTotals(monthlyTotals, calculated.amount);
  }

  let moveInTotals = { ...monthlyTotals };

  if (input.deposit) {
    moveInTotals = addToTotals(moveInTotals, input.deposit);
  }

  return { monthlyBreakdown, monthlyTotals, moveInTotals };
}
