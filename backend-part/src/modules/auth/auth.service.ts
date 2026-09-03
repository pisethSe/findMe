import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { getAppEnvironment } from "../../config/environment.js";
import { AccountStatus } from "../../generated/prisma/client.js";
import { AuthRepository, type PublicUserRecord } from "./auth.repository.js";
import type {
  AccessPrincipal,
  PublicUser,
  RequestMetadata,
  SessionTokens,
} from "./auth.types.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";

export interface PasswordResetRequestResult {
  accepted: true;
  developmentResetToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(
    input: {
      email: string;
      password: string;
      preferredLocale: "KM" | "EN";
    },
    metadata: RequestMetadata,
  ): Promise<SessionTokens> {
    const email = normalizeEmail(input.email);
    const passwordHash = await this.passwords.hash(input.password);
    const refresh = this.tokens.createRefreshToken();
    const refreshSession = {
      tokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
      userAgent: metadata.userAgent,
      ipHash: this.tokens.hashIpAddress(metadata.ipAddress),
    };

    let user: PublicUserRecord;
    try {
      user = await this.repository.createUserWithRefreshSession(
        {
          email,
          passwordHash,
          preferredLocale: input.preferredLocale,
        },
        refreshSession,
      );
    } catch (error) {
      if (this.repository.isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: "ACCOUNT_ALREADY_EXISTS",
          message: "An account already uses this email address.",
          fields: [
            { field: "email", message: "Use another email or sign in." },
          ],
        });
      }
      throw error;
    }

    const publicUser = toPublicUser(user);
    return {
      accessToken: await this.tokens.createAccessToken(publicUser),
      accessTokenExpiresInSeconds: this.tokens.accessTokenExpiresInSeconds,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
      user: publicUser,
    };
  }

  async login(
    input: { email: string; password: string },
    metadata: RequestMetadata,
  ): Promise<SessionTokens> {
    const user = await this.repository.findUserByEmail(
      normalizeEmail(input.email),
    );
    if (!user) {
      await this.passwords.performDummyVerification(input.password);
      throw invalidCredentials();
    }

    const passwordMatches = await this.passwords.verify(
      user.passwordHash,
      input.password,
    );
    if (!passwordMatches) throw invalidCredentials();

    if (
      user.accountStatus !== AccountStatus.ACTIVE ||
      user.deletedAt !== null
    ) {
      throw new ForbiddenException({
        code: "ACCOUNT_UNAVAILABLE",
        message: "This account is not available for sign in.",
      });
    }

    return this.issueSession(user, metadata);
  }

  async refresh(
    refreshToken: string,
    metadata: RequestMetadata,
  ): Promise<SessionTokens> {
    const now = new Date();
    const currentHash = this.tokens.digestRefreshToken(refreshToken);
    const session = await this.repository.findRefreshSession(currentHash);

    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw invalidRefreshSession();
    }
    if (
      session.user.accountStatus !== AccountStatus.ACTIVE ||
      session.user.deletedAt !== null
    ) {
      await this.repository.revokeRefreshSession(currentHash, now);
      throw invalidRefreshSession();
    }

    const replacement = this.tokens.createRefreshToken(now);
    const rotated = await this.repository.rotateRefreshSession(
      session.id,
      session.user.id,
      {
        tokenHash: replacement.hash,
        expiresAt: replacement.expiresAt,
        userAgent: metadata.userAgent,
        ipHash: this.tokens.hashIpAddress(metadata.ipAddress),
      },
      now,
    );
    if (!rotated) throw invalidRefreshSession();

    return {
      accessToken: await this.tokens.createAccessToken(
        toPublicUser(session.user),
      ),
      accessTokenExpiresInSeconds: this.tokens.accessTokenExpiresInSeconds,
      refreshToken: replacement.token,
      refreshTokenExpiresAt: replacement.expiresAt,
      user: toPublicUser(session.user),
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.repository.revokeRefreshSession(
      this.tokens.digestRefreshToken(refreshToken),
      new Date(),
    );
  }

  async authenticateAccessToken(token: string): Promise<AccessPrincipal> {
    const claims = await this.tokens.verifyAccessToken(token);
    const user = await this.repository.findActiveUserById(claims.id);
    if (!user) throw invalidRefreshSession();
    return toPublicUser(user);
  }

  async requestPasswordReset(
    emailInput: string,
  ): Promise<PasswordResetRequestResult> {
    const now = new Date();
    const reset = this.tokens.createPasswordResetToken(now);
    const user = await this.repository.findUserByEmail(
      normalizeEmail(emailInput),
    );

    if (
      user?.accountStatus === AccountStatus.ACTIVE &&
      user.deletedAt === null
    ) {
      await this.repository.createPasswordResetToken(
        user.id,
        reset.hash,
        reset.expiresAt,
        now,
      );
    }

    const appEnvironment = getAppEnvironment(process.env.APP_ENV);
    return appEnvironment === "local" || appEnvironment === "test"
      ? { accepted: true, developmentResetToken: reset.token }
      : { accepted: true };
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const passwordHash = await this.passwords.hash(password);
    const reset = await this.repository.consumePasswordResetToken(
      this.tokens.digestPasswordResetToken(token),
      passwordHash,
      new Date(),
    );
    if (!reset) {
      throw new UnauthorizedException({
        code: "PASSWORD_RESET_TOKEN_INVALID",
        message: "This password-reset link is invalid or has expired.",
      });
    }
  }

  private async issueSession(
    user: PublicUserRecord,
    metadata: RequestMetadata,
  ): Promise<SessionTokens> {
    const refresh = this.tokens.createRefreshToken();
    await this.repository.createRefreshSession(user.id, {
      tokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
      userAgent: metadata.userAgent,
      ipHash: this.tokens.hashIpAddress(metadata.ipAddress),
    });
    const publicUser = toPublicUser(user);

    return {
      accessToken: await this.tokens.createAccessToken(publicUser),
      accessTokenExpiresInSeconds: this.tokens.accessTokenExpiresInSeconds,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
      user: publicUser,
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

function toPublicUser(user: PublicUserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    preferredLocale: user.preferredLocale,
    onboardingComplete: user.onboardingCompletedAt !== null,
  };
}

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    code: "INVALID_CREDENTIALS",
    message: "The email or password is incorrect.",
  });
}

function invalidRefreshSession(): UnauthorizedException {
  return new UnauthorizedException({
    code: "SESSION_INVALID",
    message: "The session is missing, expired, or no longer active.",
  });
}
