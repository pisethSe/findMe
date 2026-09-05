export type MobileResultsView = "list" | "map";
export type SearchSelectionSource = "card" | "marker";
export type PublishedMapState = "fallback" | "loading" | "ready" | "error";

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
