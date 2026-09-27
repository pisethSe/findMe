import type { InstitutionDto } from "@findme/contracts";

/**
 * Shape the typed campus text before it leaves the browser.
 *
 * Khmer, Latin and mixed case are all kept exactly as typed: normalization only
 * unifies unicode forms and collapses whitespace so "Royal  University" and its
 * Khmer equivalent reach the API in a predictable shape. Matching itself stays
 * case-insensitive and bilingual on the server.
 */
export function normalizeInstitutionQuery(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function institutionInputValue(institution: InstitutionDto): string {
  return institution.nameEn;
}

export function institutionTypeLabel(type: InstitutionDto["type"]): string {
  switch (type) {
    case "UNIVERSITY":
      return "University";
    case "COLLEGE":
      return "College";
    case "SCHOOL":
      return "School";
    case "OTHER":
      return "Educational institution";
  }
}

export function nextInstitutionOptionIndex(
  current: number,
  optionCount: number,
  direction: "next" | "previous",
): number {
  if (optionCount === 0) return -1;
  if (direction === "next") return (current + 1) % optionCount;
  return current <= 0 ? optionCount - 1 : current - 1;
}

export function buildInstitutionSearchHref(
  currentSearch: string,
  institutionSlug: string,
): string {
  const params = new URLSearchParams(
    currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch,
  );
  params.delete("university");
  params.delete("page");
  params.delete("north");
  params.delete("south");
  params.delete("east");
  params.delete("west");
  params.set("institution", institutionSlug);
  return `/search?${params.toString()}`;
}
