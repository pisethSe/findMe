export type PreferredLocale = "KM" | "EN";
export type UserRole = "STUDENT" | "LANDLORD" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string | null;
  role: UserRole | null;
  preferredLocale: PreferredLocale;
  onboardingComplete: boolean;
}

export interface AuthSession {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  user: AuthUser;
}

export type OnboardingStage =
  "ROLE_SELECTION" | "STUDENT_PROFILE" | "LANDLORD_PROFILE" | "COMPLETE";

export interface StudentPreference {
  institutionId: string;
  institutionSlug: string;
  institutionNameEn: string;
  institutionNameKm: string;
  preferredRadiusMeters: number | null;
}

export interface OnboardingState {
  role: UserRole | null;
  stage: OnboardingStage;
  nextPath:
    | "/onboarding/role"
    | "/onboarding/landlord"
    | "/"
    | "/search"
    | "/landlord"
    | "/admin";
  roleSelectionComplete: boolean;
  profileComplete: boolean;
  landlordTrialActivated: boolean;
  studentPreference: StudentPreference | null;
}

export interface LandlordEntitlement {
  status: "TRIALING" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
  source: "TRIAL" | "ADMIN_GRANT" | "SUBSCRIPTION";
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  accessEndsAt: string | null;
  evaluatedAt: string;
  isAccessActive: boolean;
  remainingDays: number | null;
  capabilities: {
    canReadListings: true;
    canCreateListings: boolean;
    canSubmitListings: boolean;
    canPublishListings: boolean;
    canIncreaseAvailability: boolean;
  };
}

export interface LandlordOnboardingResult {
  onboarding: OnboardingState;
  successNextPath: "/landlord";
  profile: {
    userId: string;
    displayName: string;
    businessName: string | null;
    contactPhone: string;
    contactTelegram: string | null;
    verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  };
  entitlement: {
    landlordId: string;
    status: LandlordEntitlement["status"];
    source: LandlordEntitlement["source"];
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    accessEndsAt: string | null;
  };
}

interface ApiEnvelope<TData> {
  data: TData;
}

export interface ApiPageEnvelope<TData, TMeta> {
  data: TData;
  meta: TMeta;
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    fields?: Array<{ field: string; message: string }> | null;
  };
}

export class AuthApiError extends Error {
  readonly code: string;
  readonly fields: ReadonlyArray<{ field: string; message: string }>;

  constructor(
    message: string,
    code: string,
    fields: ReadonlyArray<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
    this.fields = fields;
  }
}

export function isAuthenticationSessionError(error: unknown): boolean {
  return (
    error instanceof AuthApiError &&
    [
      "SESSION_REQUIRED",
      "SESSION_INVALID",
      "ACCESS_TOKEN_REQUIRED",
      "ACCESS_TOKEN_INVALID",
      "ACCOUNT_UNAVAILABLE",
    ].includes(error.code)
  );
}

let inMemoryAccessToken: string | null = null;
let refreshInFlight: Promise<AuthSession> | null = null;

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function clearAccessToken(): void {
  inMemoryAccessToken = null;
}

/**
 * Signed-in account for the shared site header. The cache survives client-side
 * navigation so the header paints instantly on every page, and every response
 * that carries the session user refreshes it.
 */
let cachedAccount: AuthUser | null = null;
let accountResolved = false;

function rememberAccount(user: AuthUser): void {
  cachedAccount = user;
  accountResolved = true;
}

/** The last resolved account without a network call, for instant header paint. */
export function peekAccount(): AuthUser | null {
  return accountResolved ? cachedAccount : null;
}

/**
 * Resolve the signed-in account for the site header. Returns null when the
 * session is missing or the lookup fails, so the header falls back to the
 * sign-in links instead of breaking the page.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (accountResolved) return cachedAccount;
  try {
    const user = await authorizedRequest<AuthUser>("/auth/me", {
      method: "GET",
    });
    rememberAccount(user);
    return cachedAccount;
  } catch {
    accountResolved = true;
    cachedAccount = null;
    return null;
  }
}

/** End the local session first so the header flips even if the network fails. */
export async function signOut(): Promise<void> {
  accountResolved = true;
  cachedAccount = null;
  clearAccessToken();
  try {
    await fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // The UI session is already gone; an offline sign-out still succeeds here.
  }
}

export async function register(input: {
  email: string;
  password: string;
  preferredLocale: PreferredLocale;
}): Promise<AuthSession> {
  const session = await request<AuthSession>("/auth/register", {
    method: "POST",
    body: input,
  });
  inMemoryAccessToken = session.accessToken;
  rememberAccount(session.user);
  return session;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const session = await request<AuthSession>("/auth/login", {
    method: "POST",
    body: input,
  });
  inMemoryAccessToken = session.accessToken;
  rememberAccount(session.user);
  return session;
}

export async function refreshSession(): Promise<AuthSession> {
  if (!refreshInFlight) {
    refreshInFlight = request<AuthSession>("/auth/refresh", {
      method: "POST",
      body: {},
    })
      .then((session) => {
        inMemoryAccessToken = session.accessToken;
        rememberAccount(session.user);
        return session;
      })
      .catch((error: unknown) => {
        inMemoryAccessToken = null;
        throw error;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function requestPasswordReset(email: string): Promise<{
  accepted: true;
  developmentResetToken?: string;
}> {
  return request("/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ passwordReset: true }> {
  return request("/auth/reset-password", {
    method: "POST",
    body: { token, password },
  });
}

export async function getOnboardingState(): Promise<OnboardingState> {
  return authorizedRequest("/me/onboarding", { method: "GET" });
}

export interface AuthProviders {
  google: boolean;
}

/** Which sign-in providers this server can complete right now. */
export async function fetchAuthProviders(): Promise<AuthProviders> {
  const data = await request<AuthProviders>("/auth/providers", {
    method: "GET",
  });
  return { google: data.google === true };
}

/**
 * Browser entry point for Google sign-in. The backend signs `next` inside the
 * OAuth state, so only the start URL needs it. `next` must already be a safe
 * relative path (the auth forms pass `safeStudentReturnPath` results).
 */
export function googleSignInUrl(next: string | null): string {
  const query = next ? `?${new URLSearchParams({ next })}` : "";
  return `${getApiBaseUrl()}/auth/google/start${query}`;
}

export async function selectRole(input: {
  role: "STUDENT" | "LANDLORD";
  displayName?: string;
  institutionId?: string;
  preferredRadiusMeters?: number;
  preferredMinPrice?: number;
  preferredMaxPrice?: number;
}): Promise<OnboardingState> {
  const state = await authorizedRequest<OnboardingState>(
    "/me/onboarding/role",
    { method: "POST", body: input },
  );
  if (accountResolved && cachedAccount) {
    // The header shows role-aware links, so keep it truthful after onboarding.
    cachedAccount = {
      ...cachedAccount,
      role: state.role,
      onboardingComplete: state.profileComplete,
    };
  }
  return state;
}

export async function completeLandlordOnboarding(input: {
  displayName: string;
  businessName?: string;
  contactPhone: string;
  contactTelegram?: string;
}): Promise<LandlordOnboardingResult> {
  return authorizedRequest("/landlord/onboarding", {
    method: "POST",
    body: input,
  });
}

export async function getLandlordEntitlement(): Promise<LandlordEntitlement> {
  return authorizedRequest("/landlord/entitlement", { method: "GET" });
}

export async function getPostAuthenticationState(): Promise<OnboardingState> {
  return getOnboardingState();
}

export async function authorizedRequest<TData>(
  path: string,
  options: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: object;
  },
): Promise<TData> {
  return withAuthorization((accessToken) =>
    request<TData>(path, { ...options, accessToken }),
  );
}

export async function authorizedPageRequest<TData, TMeta>(
  path: string,
  options: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: object;
  },
): Promise<ApiPageEnvelope<TData, TMeta>> {
  return withAuthorization((accessToken) =>
    requestPage<TData, TMeta>(path, { ...options, accessToken }),
  );
}

async function withAuthorization<TData>(
  operation: (accessToken: string) => Promise<TData>,
): Promise<TData> {
  const accessToken = await ensureAccessToken();
  try {
    return await operation(accessToken);
  } catch (error) {
    if (
      !(error instanceof AuthApiError) ||
      !["ACCESS_TOKEN_INVALID", "SESSION_INVALID"].includes(error.code)
    ) {
      throw error;
    }

    clearAccessToken();
    const session = await refreshSession();
    return operation(session.accessToken);
  }
}

async function ensureAccessToken(): Promise<string> {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  return (await refreshSession()).accessToken;
}

async function request<TData>(
  path: string,
  options: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: object;
    accessToken?: string;
  },
): Promise<TData> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.accessToken
        ? { authorization: `Bearer ${options.accessToken}` }
        : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as
    ApiEnvelope<TData> | ErrorEnvelope;

  if (!response.ok || !("data" in payload)) {
    const error = "error" in payload ? payload.error : undefined;
    throw new AuthApiError(
      error?.message ?? "FindMe could not complete the request.",
      error?.code ?? "REQUEST_FAILED",
      error?.fields ?? [],
    );
  }

  return payload.data;
}

async function requestPage<TData, TMeta>(
  path: string,
  options: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: object;
    accessToken?: string;
  },
): Promise<ApiPageEnvelope<TData, TMeta>> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.accessToken
        ? { authorization: `Bearer ${options.accessToken}` }
        : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as
    ApiPageEnvelope<TData, TMeta> | ErrorEnvelope;

  if (!response.ok || !("data" in payload) || !("meta" in payload)) {
    const error = "error" in payload ? payload.error : undefined;
    throw new AuthApiError(
      error?.message ?? "FindMe could not complete the request.",
      error?.code ?? "REQUEST_FAILED",
      error?.fields ?? [],
    );
  }

  return payload;
}

function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:3001/api/v1"
  );
}
