export type MobileResultsView = "list" | "map";
export type SearchSelectionSource = "card" | "marker";
export type PublishedMapState = "fallback" | "loading" | "ready" | "error";

export const MAP_VIEWPORT_DEBOUNCE_MS = 450;

/**
 * Both card and marker activation keep the map visible on phones: activating a
 * card pans to its pin, and activating a marker opens the selected-rental popup
 * instead of hiding the map. The popup's "Show in list" action is the route back
 * to the full card list.
 */
export const RESULTS_VIEW_AFTER_SELECTION: MobileResultsView = "map";

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

/**
 * Listings that were not on the map during the previous marker pass. Only these
 * markers receive the short appear transition; unchanged results stay still.
 * `null` means no pass has completed yet, so the first render is not animated.
 */
export function appearedListingIds(
  previousIds: readonly string[] | null,
  currentIds: readonly string[],
): readonly string[] {
  if (previousIds === null) return [];
  const known = new Set(previousIds);
  return currentIds.filter((listingId) => !known.has(listingId));
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
