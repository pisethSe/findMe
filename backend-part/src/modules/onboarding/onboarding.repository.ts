import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";
import {
  AccountStatus,
  EntitlementSource,
  EntitlementStatus,
  UserRole,
} from "../../generated/prisma/client.js";
import type {
  LandlordActivationRecord,
  OnboardingUserRecord,
} from "./onboarding.types.js";

const onboardingStateSelect = {
  id: true,
  role: true,
  accountStatus: true,
  onboardingCompletedAt: true,
  deletedAt: true,
  studentProfile: { select: { displayName: true } },
  landlordProfile: { select: { userId: true } },
  landlordEntitlement: { select: { landlordId: true } },
} as const;

const landlordProfileSelect = {
  userId: true,
  displayName: true,
  businessName: true,
  contactPhone: true,
  contactTelegram: true,
  verificationStatus: true,
} as const;

const entitlementSelect = {
  landlordId: true,
  status: true,
  source: true,
  trialStartedAt: true,
  trialEndsAt: true,
  accessEndsAt: true,
} as const;

export type RoleSelectionResult =
  | { outcome: "SELECTED" | "IDEMPOTENT"; user: OnboardingUserRecord }
  | { outcome: "ROLE_CONFLICT"; currentRole: UserRole }
  | { outcome: "STATE_INVALID" }
  | { outcome: "USER_NOT_FOUND" };

export type LandlordActivationResult =
  | {
      outcome: "ACTIVATED" | "IDEMPOTENT";
      activation: LandlordActivationRecord;
    }
  | { outcome: "ROLE_REQUIRED" }
  | { outcome: "ROLE_FORBIDDEN" }
  | { outcome: "STATE_INVALID" }
  | { outcome: "USER_NOT_FOUND" };

@Injectable()
export class OnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserState(userId: string): Promise<OnboardingUserRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
      },
      select: onboardingStateSelect,
    });
  }

  async selectRole(
    userId: string,
    role: "STUDENT" | "LANDLORD",
    studentDisplayName: string | undefined,
    now: Date,
  ): Promise<RoleSelectionResult> {
    return this.prisma.$transaction(async (transaction) => {
      const selected = await transaction.user.updateMany({
        where: {
          id: userId,
          role: null,
          onboardingCompletedAt: null,
          accountStatus: AccountStatus.ACTIVE,
          deletedAt: null,
        },
        data: { role, onboardingCompletedAt: now },
      });

      if (selected.count === 1 && role === UserRole.STUDENT) {
        if (!studentDisplayName) {
          throw new Error(
            "Student role selection requires a validated display name.",
          );
        }
        await transaction.studentProfile.create({
          data: { userId, displayName: studentDisplayName },
        });
      }

      let user = await transaction.user.findFirst({
        where: {
          id: userId,
          accountStatus: AccountStatus.ACTIVE,
          deletedAt: null,
        },
        select: onboardingStateSelect,
      });
      if (!user) return { outcome: "USER_NOT_FOUND" as const };

      if (selected.count === 0) {
        if (!user.role) return { outcome: "STATE_INVALID" as const };
        if (user.role !== role) {
          return {
            outcome: "ROLE_CONFLICT" as const,
            currentRole: user.role,
          };
        }

        if (
          role === UserRole.STUDENT &&
          !user.studentProfile &&
          studentDisplayName
        ) {
          await transaction.studentProfile.create({
            data: { userId, displayName: studentDisplayName },
          });
          user = await transaction.user.findUniqueOrThrow({
            where: { id: userId },
            select: onboardingStateSelect,
          });
        }
      }

      return {
        outcome: selected.count === 1 ? "SELECTED" : "IDEMPOTENT",
        user,
      };
    });
  }

  async activateLandlord(
    userId: string,
    input: {
      displayName: string;
      businessName?: string;
      contactPhone: string;
      contactTelegram?: string;
    },
    now: Date,
    trialEndsAt: Date,
  ): Promise<LandlordActivationResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.findFirst({
          where: {
            id: userId,
            accountStatus: AccountStatus.ACTIVE,
            deletedAt: null,
          },
          select: {
            role: true,
            landlordProfile: { select: landlordProfileSelect },
            landlordEntitlement: { select: entitlementSelect },
          },
        });

        if (!user) return { outcome: "USER_NOT_FOUND" as const };
        if (!user.role) return { outcome: "ROLE_REQUIRED" as const };
        if (user.role !== UserRole.LANDLORD) {
          return { outcome: "ROLE_FORBIDDEN" as const };
        }

        if (user.landlordProfile && user.landlordEntitlement) {
          return {
            outcome: "IDEMPOTENT" as const,
            activation: {
              profile: user.landlordProfile,
              entitlement: user.landlordEntitlement,
            },
          };
        }
        if (user.landlordProfile || user.landlordEntitlement) {
          return { outcome: "STATE_INVALID" as const };
        }

        const profile = await transaction.landlordProfile.create({
          data: { userId, ...input },
          select: landlordProfileSelect,
        });
        const entitlement = await transaction.landlordEntitlement.create({
          data: {
            landlordId: userId,
            status: EntitlementStatus.TRIALING,
            source: EntitlementSource.TRIAL,
            trialStartedAt: now,
            trialEndsAt,
            accessEndsAt: trialEndsAt,
          },
          select: entitlementSelect,
        });

        return {
          outcome: "ACTIVATED" as const,
          activation: { profile, entitlement },
        };
      });
    } catch (error) {
      if (!isPrismaErrorWithCode(error, "P2002")) throw error;

      const existing = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          landlordProfile: { select: landlordProfileSelect },
          landlordEntitlement: { select: entitlementSelect },
        },
      });
      return existing?.landlordProfile && existing.landlordEntitlement
        ? {
            outcome: "IDEMPOTENT",
            activation: {
              profile: existing.landlordProfile,
              entitlement: existing.landlordEntitlement,
            },
          }
        : { outcome: "STATE_INVALID" };
    }
  }
}

function isPrismaErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
