import type { OnboardingState, StudentPreference } from "./auth-api.ts";

/**
 * Build the student's destination from the campus the server stored during
 * onboarding. The slug comes from the server response, never from the browser,
 * and the radius is only applied when the student actually chose one.
 */
export function studentCampusSearchPath(
  preference: StudentPreference | null,
): string | null {
  if (!preference || !isSafeCampusSlug(preference.institutionSlug)) return null;

  const params = new URLSearchParams({
    institution: preference.institutionSlug,
  });
  if (preference.preferredRadiusMeters !== null) {
    params.set(
      "maxDistanceKm",
      String(preference.preferredRadiusMeters / 1_000),
    );
  }
  return `/search?${params.toString()}`;
}

function isSafeCampusSlug(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 160 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

/** Routes a student may reach without completing onboarding. */
const STUDENT_ROUTES: ReadonlySet<OnboardingState["nextPath"]> = new Set([
  "/",
  "/search",
]);

/**
 * Where a student should land after onboarding or sign-in.
 *
 * Incomplete onboarding always wins, and a safe return target is carried
 * through it as `next` so a deep link is never lost. Once onboarding is
 * complete, a safe return target still wins; otherwise the campus saved during
 * onboarding is used, and only then the generic server route.
 */
export function studentDestination(
  state: Pick<OnboardingState, "nextPath" | "studentPreference">,
  returnTo: string | null | undefined,
): string {
  const safe = safeStudentReturnPath(returnTo);
  const onboardingPending =
    state.nextPath === "/onboarding/role" ||
    state.nextPath === "/onboarding/landlord";

  // Onboarding is server-owned. While it is unfinished, a return target is
  // carried through it as `next` and never replaces the onboarding route.
  if (onboardingPending) {
    return safe && state.nextPath === "/onboarding/role"
      ? `${state.nextPath}?${new URLSearchParams({ next: safe })}`
      : state.nextPath;
  }
  if (safe) return safe;

  // The saved campus only refines a student discovery route. Landlords and
  // admins keep their own server-provided destination.
  if (STUDENT_ROUTES.has(state.nextPath)) {
    return studentCampusSearchPath(state.studentPreference) ?? state.nextPath;
  }
  return state.nextPath;
}

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
