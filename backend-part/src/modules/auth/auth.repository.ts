import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";
import {
  AccountStatus,
  type PreferredLocale,
  type UserRole,
} from "../../generated/prisma/client.js";

const userAuthenticationSelect = {
  id: true,
  email: true,
  passwordHash: true,
  role: true,
  accountStatus: true,
  preferredLocale: true,
  onboardingCompletedAt: true,
  deletedAt: true,
} as const;

const publicUserSelect = {
  id: true,
  email: true,
  role: true,
  accountStatus: true,
  preferredLocale: true,
  onboardingCompletedAt: true,
  deletedAt: true,
} as const;

export interface AuthenticationUserRecord {
  id: string;
  email: string | null;
  passwordHash: string;
  role: UserRole | null;
  accountStatus: "ACTIVE" | "SUSPENDED" | "DELETED";
  preferredLocale: PreferredLocale;
  onboardingCompletedAt: Date | null;
  deletedAt: Date | null;
}

export type PublicUserRecord = Omit<AuthenticationUserRecord, "passwordHash">;

export interface RefreshSessionRecord {
  id: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: PublicUserRecord;
}

export interface CreateSessionRecord {
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ipHash: string | null;
}

function isPrismaErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUserWithRefreshSession(
    input: {
      email: string;
      passwordHash: string;
      preferredLocale: PreferredLocale;
    },
    session: CreateSessionRecord,
  ): Promise<AuthenticationUserRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: input,
        select: userAuthenticationSelect,
      });
      await transaction.refreshSession.create({
        data: { userId: user.id, ...session },
      });
      return user;
    });
  }

  isUniqueConstraintError(error: unknown): boolean {
    return isPrismaErrorWithCode(error, "P2002");
  }

  async findUserByEmail(
    normalizedEmail: string,
  ): Promise<AuthenticationUserRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
      select: userAuthenticationSelect,
    });
  }

  async findActiveUserById(userId: string): Promise<PublicUserRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
      },
      select: publicUserSelect,
    });
  }

  async createRefreshSession(
    userId: string,
    session: CreateSessionRecord,
  ): Promise<void> {
    await this.prisma.refreshSession.create({
      data: { userId, ...session },
    });
  }

  async findRefreshSession(
    tokenHash: string,
  ): Promise<RefreshSessionRecord | null> {
    return this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: publicUserSelect },
      },
    });
  }

  async rotateRefreshSession(
    currentSessionId: string,
    userId: string,
    replacement: CreateSessionRecord,
    now: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshSession.updateMany({
        where: {
          id: currentSessionId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      if (revoked.count !== 1) return false;

      await transaction.refreshSession.create({
        data: { userId, ...replacement },
      });
      return true;
    });
  }

  async revokeRefreshSession(tokenHash: string, now: Date): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      });
      await transaction.passwordResetToken.create({
        data: { userId, tokenHash, expiresAt },
      });
    });
  }

  async consumePasswordResetToken(
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const token = await transaction.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, expiresAt: true, usedAt: true },
      });

      if (!token || token.usedAt || token.expiresAt <= now) return false;

      const consumed = await transaction.passwordResetToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return false;

      await transaction.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      });
      await transaction.refreshSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });
  }
}
