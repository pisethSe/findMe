import type { SearchViewport } from "@findme/contracts";

type SearchParamValue = string | readonly string[] | undefined;
type SearchParamRecord = Readonly<Record<string, SearchParamValue>>;

export interface ParsedSearchMapState {
  page: number;
  viewport: SearchViewport | null;
  invalid: boolean;
}

const VIEWPORT_KEYS = ["north", "south", "east", "west"] as const;
const VIEWPORT_PRECISION = 5;

export function parseSearchMapState(
  params: SearchParamRecord,
): ParsedSearchMapState {
  const rawPage = firstValue(params.page);
  const page = parsePage(rawPage);
  const rawViewport = VIEWPORT_KEYS.map((key) => firstValue(params[key]));
  const suppliedViewportValues = rawViewport.filter(
    (value) => value !== undefined && value !== "",
  );

  if (suppliedViewportValues.length === 0) {
    return {
      page: page.value,
      viewport: null,
      invalid: page.invalid,
    };
  }

  if (suppliedViewportValues.length !== VIEWPORT_KEYS.length) {
    return { page: page.value, viewport: null, invalid: true };
  }

  const viewport: SearchViewport = {
    north: Number(rawViewport[0]),
    south: Number(rawViewport[1]),
    east: Number(rawViewport[2]),
    west: Number(rawViewport[3]),
  };
  if (!isSearchViewport(viewport)) {
    return { page: page.value, viewport: null, invalid: true };
  }

  return {
    page: page.value,
    viewport: normalizeSearchViewport(viewport),
    invalid: page.invalid,
  };
}

export function normalizeSearchViewport(
  viewport: SearchViewport,
): SearchViewport {
  return {
    north: roundCoordinate(viewport.north),
    south: roundCoordinate(viewport.south),
    east: roundCoordinate(viewport.east),
    west: roundCoordinate(viewport.west),
  };
}

export function searchViewportsEqual(
  left: SearchViewport | null,
  right: SearchViewport | null,
): boolean {
  if (left === null || right === null) return left === right;
  const normalizedLeft = normalizeSearchViewport(left);
  const normalizedRight = normalizeSearchViewport(right);
  return VIEWPORT_KEYS.every(
    (key) => normalizedLeft[key] === normalizedRight[key],
  );
}

export function buildSearchMapHref(
  currentSearch: string,
  state: { page: number; viewport: SearchViewport | null },
): string {
  const params = new URLSearchParams(currentSearch);
  if (state.page > 1) params.set("page", String(state.page));
  else params.delete("page");

  if (state.viewport) {
    const viewport = normalizeSearchViewport(state.viewport);
    VIEWPORT_KEYS.forEach((key) => {
      params.set(key, String(viewport[key]));
    });
  } else {
    VIEWPORT_KEYS.forEach((key) => params.delete(key));
  }

  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

export function isSearchViewport(
  value: SearchViewport,
): value is SearchViewport {
  return (
    Number.isFinite(value.north) &&
    value.north >= -90 &&
    value.north <= 90 &&
    Number.isFinite(value.south) &&
    value.south >= -90 &&
    value.south <= 90 &&
    Number.isFinite(value.east) &&
    value.east >= -180 &&
    value.east <= 180 &&
    Number.isFinite(value.west) &&
    value.west >= -180 &&
    value.west <= 180 &&
    value.north > value.south &&
    value.east > value.west
  );
}

function parsePage(value: string | undefined): {
  value: number;
  invalid: boolean;
} {
  if (value === undefined || value === "") return { value: 1, invalid: false };
  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 10_000;
  return { value: valid ? parsed : 1, invalid: !valid };
}

function firstValue(value: SearchParamValue): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(VIEWPORT_PRECISION));
}
