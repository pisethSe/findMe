export const MODERATION_PAGE_SIZE = 20;

export function pageAfterModerationDecision(
  currentPage: number,
  currentPageCount: number,
): number {
  return currentPageCount === 1 && currentPage > 1
    ? currentPage - 1
    : currentPage;
}
