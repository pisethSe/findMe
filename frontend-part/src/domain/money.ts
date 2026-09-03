export const SUPPORTED_CURRENCIES = ["USD", "KHR"] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export interface Money {
  /** Integer value in the currency's ISO minor unit. */
  amountMinor: number;
  currency: Currency;
}

export type TotalsByCurrency = Partial<Record<Currency, number>>;

export function assertMoney(value: Money): void {
  if (!Number.isSafeInteger(value.amountMinor) || value.amountMinor < 0) {
    throw new RangeError("Money must be a non-negative safe integer.");
  }
}

export function addToTotals(
  totals: TotalsByCurrency,
  value: Money,
): TotalsByCurrency {
  assertMoney(value);

  return {
    ...totals,
    [value.currency]: (totals[value.currency] ?? 0) + value.amountMinor,
  };
}

export function multiplyMoney(value: Money, quantity: number): Money {
  assertMoney(value);

  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new RangeError("Quantity must be a non-negative finite number.");
  }

  const amountMinor = Math.round(value.amountMinor * quantity);

  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError("Calculated money exceeds the safe integer range.");
  }

  return { amountMinor, currency: value.currency };
}
