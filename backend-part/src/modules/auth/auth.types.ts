import type { UserRole } from "../../generated/prisma/client.js";

export interface PublicUser {
  id: string;
  email: string | null;
  role: UserRole | null;
  preferredLocale: "KM" | "EN";
  onboardingComplete: boolean;
}

export interface AccessPrincipal extends PublicUser {}

export interface RequestMetadata {
  userAgent: string | null;
  ipAddress: string | null;
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: PublicUser;
}

export interface AuthenticatedRequest {
  user: AccessPrincipal;
}

/**
 * Identity claims returned by Google's userinfo endpoint for this session.
 */
export interface GoogleIdentity {
  subject: string;
  email: string;
}

/**
 * Stored in `users.password_hash` for accounts created through Google so the
 * column's NOT NULL constraint holds. Argon2 verification always fails against
 * it, so these accounts cannot sign in with a password until they set one
 * through the normal password-reset flow.
 */
export const OAUTH_ONLY_PASSWORD_HASH = "google-oauth:pending-password";
