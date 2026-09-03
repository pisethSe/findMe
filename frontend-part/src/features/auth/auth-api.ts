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

export interface OnboardingState {
  role: UserRole | null;
  stage: OnboardingStage;
  nextPath:
    | "/onboarding/role"
    | "/onboarding/landlord"
    | "/search"
    | "/landlord"
    | "/admin";
  roleSelectionComplete: boolean;
  profileComplete: boolean;
  landlordTrialActivated: boolean;
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

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    fields?: Array<{ field: string; message: string }> | null;
  };
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly fields: ReadonlyArray<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = "AuthApiError";
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
        return session;
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

export async function selectRole(input: {
  role: "STUDENT" | "LANDLORD";
  displayName?: string;
}): Promise<OnboardingState> {
  return authorizedRequest("/me/onboarding/role", {
    method: "POST",
    body: input,
  });
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

export async function getPostAuthenticationPath(): Promise<
  OnboardingState["nextPath"]
> {
  return (await getOnboardingState()).nextPath;
}

async function authorizedRequest<TData>(
  path: string,
  options: { method: "GET" | "POST"; body?: object },
): Promise<TData> {
  const accessToken = await ensureAccessToken();
  try {
    return await request<TData>(path, { ...options, accessToken });
  } catch (error) {
    if (
      !(error instanceof AuthApiError) ||
      !["ACCESS_TOKEN_INVALID", "SESSION_INVALID"].includes(error.code)
    ) {
      throw error;
    }

    clearAccessToken();
    const session = await refreshSession();
    return request<TData>(path, {
      ...options,
      accessToken: session.accessToken,
    });
  }
}

async function ensureAccessToken(): Promise<string> {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  return (await refreshSession()).accessToken;
}

async function request<TData>(
  path: string,
  options: {
    method: "GET" | "POST";
    body?: object;
    accessToken?: string;
  },
): Promise<TData> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method,
    credentials: "include",
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

function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:3001/api/v1"
  );
}
