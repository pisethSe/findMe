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

let inMemoryAccessToken: string | null = null;

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
  const session = await post<AuthSession>("/auth/register", input);
  inMemoryAccessToken = session.accessToken;
  return session;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const session = await post<AuthSession>("/auth/login", input);
  inMemoryAccessToken = session.accessToken;
  return session;
}

export async function refreshSession(): Promise<AuthSession> {
  const session = await post<AuthSession>("/auth/refresh", {});
  inMemoryAccessToken = session.accessToken;
  return session;
}

export async function requestPasswordReset(email: string): Promise<{
  accepted: true;
  developmentResetToken?: string;
}> {
  return post("/auth/forgot-password", { email });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ passwordReset: true }> {
  return post("/auth/reset-password", { token, password });
}

async function post<TData>(path: string, body: object): Promise<TData> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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
