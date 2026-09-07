import type { OnboardingState } from "./auth-api.ts";

export function safeStudentReturnPath(
  value: string | null | undefined,
): string | null {
  if (
    !value ||
    value.length > 4096 ||
    value.includes("\\") ||
    Array.from(value).some((character) => character.charCodeAt(0) <= 32) ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return null;
  try {
    const url = new URL(value, "https://findme.invalid");
    if (url.origin !== "https://findme.invalid" || url.hash) return null;
    if (
      !["/favorites", "/search", "/inquiries"].includes(url.pathname) &&
      !/^\/rentals\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url.pathname)
    )
      return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function studentPostAuthPath(
  nextPath: OnboardingState["nextPath"],
  returnTo: string | null | undefined,
): string {
  const safe = safeStudentReturnPath(returnTo);
  if (!safe) return nextPath;
  if (nextPath === "/search") return safe;
  if (nextPath === "/onboarding/role")
    return `${nextPath}?${new URLSearchParams({ next: safe })}`;
  return nextPath;
}
