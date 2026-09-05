export const VISIBLE_SEARCH_REFRESH_MS = 45_000;

export function shouldRefreshVisibleSearch(
  visibilityState: DocumentVisibilityState,
): boolean {
  return visibilityState === "visible";
}
