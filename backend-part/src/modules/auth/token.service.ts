import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

import {
  getAuthSecret,
  parseAccessTokenTtl,
  parsePasswordResetTtlMinutes,
  parseRefreshTokenTtlDays,
} from "../../config/environment.js";
import type { AccessPrincipal, PublicUser } from "./auth.types.js";

const TOKEN_ISSUER = "findme-api";
const TOKEN_AUDIENCE = "findme-web";

@Injectable()
export class TokenService {
  private readonly accessSecret = new TextEncoder().encode(
    getAuthSecret("JWT_ACCESS_SECRET", process.env.JWT_ACCESS_SECRET),
  );
  private readonly refreshSecret = getAuthSecret(
    "REFRESH_TOKEN_SECRET",
    process.env.REFRESH_TOKEN_SECRET,
  );
  private readonly accessTtl = parseAccessTokenTtl(process.env.JWT_ACCESS_TTL);
  private readonly refreshTtlDays = parseRefreshTokenTtlDays(
    process.env.REFRESH_TOKEN_TTL_DAYS,
  );
  private readonly passwordResetTtlMinutes = parsePasswordResetTtlMinutes(
    process.env.PASSWORD_RESET_TTL_MINUTES,
  );

  get accessTokenExpiresInSeconds(): number {
    return this.accessTtl.seconds;
  }

  async createAccessToken(user: PublicUser): Promise<string> {
    return new SignJWT({
      tokenUse: "access",
      role: user.role,
      preferredLocale: user.preferredLocale,
      onboardingComplete: user.onboardingComplete,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setSubject(user.id)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(this.accessTtl.label)
      .sign(this.accessSecret);
  }

  async verifyAccessToken(token: string): Promise<AccessPrincipal> {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret, {
        algorithms: ["HS256"],
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      });

      if (
        payload.tokenUse !== "access" ||
        typeof payload.sub !== "string" ||
        ![null, "STUDENT", "LANDLORD", "ADMIN"].includes(
          payload.role as string | null,
        ) ||
        !["KM", "EN"].includes(payload.preferredLocale as string) ||
        typeof payload.onboardingComplete !== "boolean"
      ) {
        throw new Error("invalid claims");
      }

      return {
        id: payload.sub,
        email: null,
        role: payload.role as AccessPrincipal["role"],
        preferredLocale:
          payload.preferredLocale as AccessPrincipal["preferredLocale"],
        onboardingComplete: payload.onboardingComplete,
      };
    } catch {
      throw new UnauthorizedException({
        code: "ACCESS_TOKEN_INVALID",
        message: "The access token is missing, expired, or invalid.",
      });
    }
  }

  createRefreshToken(now = new Date()): {
    token: string;
    hash: string;
    expiresAt: Date;
  } {
    const token = randomBytes(32).toString("base64url");
    return {
      token,
      hash: this.digest("refresh", token),
      expiresAt: new Date(
        now.getTime() + this.refreshTtlDays * 24 * 60 * 60 * 1000,
      ),
    };
  }

  createPasswordResetToken(now = new Date()): {
    token: string;
    hash: string;
    expiresAt: Date;
  } {
    const token = randomBytes(32).toString("base64url");
    return {
      token,
      hash: this.digest("password-reset", token),
      expiresAt: new Date(
        now.getTime() + this.passwordResetTtlMinutes * 60 * 1000,
      ),
    };
  }

  digestRefreshToken(token: string): string {
    return this.digest("refresh", token);
  }

  digestPasswordResetToken(token: string): string {
    return this.digest("password-reset", token);
  }

  hashIpAddress(ipAddress: string | null): string | null {
    return ipAddress ? this.digest("ip", ipAddress) : null;
  }

  private digest(purpose: string, value: string): string {
    return createHmac("sha256", this.refreshSecret)
      .update(`${purpose}:${value}`)
      .digest("hex");
  }
}
