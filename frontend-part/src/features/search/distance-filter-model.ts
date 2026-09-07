// Keep these limits aligned with the public NestJS search DTO (integer metres).
export const MIN_SEARCH_RADIUS_METERS = 100;
export const MAX_SEARCH_RADIUS_METERS = 20_000;
export const DEFAULT_SEARCH_RADIUS_METERS = 5_000;
export const SEARCH_RADIUS_PRESETS_METERS = [
  1_000, 2_000, 3_000, 5_000, 10_000, 20_000,
] as const;

export function isSearchRadius(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_SEARCH_RADIUS_METERS &&
    value <= MAX_SEARCH_RADIUS_METERS
  );
}

export function radiusFromKilometres(value: string): number | undefined {
  // Parse decimal text directly to integer metres, without floating-point rounding.
  const match = /^(\d{1,2})?(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return undefined;
  const metres =
    Number(match[1] ?? 0) * 1_000 + Number((match[2] ?? "").padEnd(3, "0"));
  return isSearchRadius(metres) ? metres : undefined;
}

export function parseDistanceFilter(
  value: string | readonly string[] | undefined,
): { radiusMeters: number; invalid: boolean } {
  if (value === undefined) {
    return { radiusMeters: DEFAULT_SEARCH_RADIUS_METERS, invalid: false };
  }
  const radiusMeters =
    typeof value === "string" ? radiusFromKilometres(value) : undefined;
  return {
    radiusMeters: radiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS,
    invalid: radiusMeters === undefined,
  };
}

export function nextSearchRadius(radiusMeters: number): number | null {
  return (
    SEARCH_RADIUS_PRESETS_METERS.find((radius) => radius > radiusMeters) ?? null
  );
}

export function formatSearchRadius(radiusMeters: number): string {
  return `${radiusMeters / 1_000} km`;
}
