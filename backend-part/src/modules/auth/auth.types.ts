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
