export type MobileResultsView = "list" | "map";
export type SearchSelectionSource = "card" | "marker";
export type PublishedMapState = "fallback" | "loading" | "ready" | "error";

export const MAP_VIEWPORT_DEBOUNCE_MS = 450;

export function viewAfterResultSelection(
  source: SearchSelectionSource,
): MobileResultsView {
  return source === "card" ? "map" : "list";
}

export function resultScrollBehavior(
  prefersReducedMotion: boolean,
): "auto" | "smooth" {
  return prefersReducedMotion ? "auto" : "smooth";
}

export function canRetryPublishedMap(
  mapsConfigured: boolean,
  state: PublishedMapState,
): boolean {
  return mapsConfigured && state === "error";
}

export function visibleResultRange(
  page: number,
  pageSize: number,
  total: number,
): { first: number; last: number } {
  if (total === 0) return { first: 0, last: 0 };
  const first = (page - 1) * pageSize + 1;
  return { first, last: Math.min(first + pageSize - 1, total) };
}
