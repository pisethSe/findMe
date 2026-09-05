import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { UserRole } from "../../generated/prisma/client.js";
import type { AccessPrincipal } from "../auth/auth.types.js";
import { OnboardingRepository } from "./onboarding.repository.js";
import type { CompleteLandlordOnboardingDto } from "./dto/complete-landlord-onboarding.dto.js";
import type { SelectRoleDto } from "./dto/select-role.dto.js";
import type {
  LandlordActivationRecord,
  OnboardingState,
  OnboardingUserRecord,
} from "./onboarding.types.js";

const LANDLORD_TRIAL_MILLISECONDS = 7 * 24 * 60 * 60 * 1_000;

@Injectable()
export class OnboardingService {
  constructor(private readonly repository: OnboardingRepository) {}

  async getState(userId: string): Promise<OnboardingState> {
    const user = await this.repository.findUserState(userId);
    if (!user) throw accountUnavailable();
    return toOnboardingState(user);
  }

  async selectRole(
    userId: string,
    input: SelectRoleDto,
  ): Promise<OnboardingState> {
    if (input.role === "LANDLORD" && input.displayName !== undefined) {
      throw new BadRequestException({
        code: "ROLE_PROFILE_FIELDS_INVALID",
        message:
          "Landlord profile details belong in the landlord onboarding step.",
        fields: [
          {
            field: "displayName",
            message: "Complete this field during landlord onboarding.",
          },
        ],
      });
    }

    if (input.role === "STUDENT" && !input.displayName) {
      const current = await this.repository.findUserState(userId);
      if (!current) throw accountUnavailable();
      if (
        current.role === UserRole.STUDENT &&
        current.studentProfile !== null
      ) {
        return toOnboardingState(current);
      }
      throw new BadRequestException({
        code: "STUDENT_PROFILE_REQUIRED",
        message: "Enter a display name to complete the student profile.",
        fields: [
          {
            field: "displayName",
            message: "Display name is required for a student account.",
          },
        ],
      });
    }

    const role =
      input.role === "STUDENT" ? UserRole.STUDENT : UserRole.LANDLORD;
    const result = await this.repository.selectRole(
      userId,
      role,
      input.displayName,
      new Date(),
    );

    if (result.outcome === "USER_NOT_FOUND") throw accountUnavailable();
    if (result.outcome === "STATE_INVALID") {
      throw new ConflictException({
        code: "ONBOARDING_STATE_INVALID",
        message:
          "This account setup is incomplete. Contact support before trying again.",
      });
    }
    if (result.outcome === "ROLE_CONFLICT") {
      throw new ConflictException({
        code: "ROLE_ALREADY_SELECTED",
        message:
          "Your account role is already set and cannot be changed through onboarding.",
        fields: [{ field: "role", message: "Your existing role is kept." }],
      });
    }

    return toOnboardingState(result.user);
  }

  async completeLandlordOnboarding(
    principal: AccessPrincipal,
    input: CompleteLandlordOnboardingDto,
  ): Promise<{
    onboarding: OnboardingState;
    activation: LandlordActivationRecord;
    successNextPath: "/landlord/listings/new" | "/landlord";
  }> {
    if (principal.role !== UserRole.LANDLORD) {
      throw new ForbiddenException({
        code: "LANDLORD_ROLE_REQUIRED",
        message: "Choose the landlord role before completing this profile.",
      });
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + LANDLORD_TRIAL_MILLISECONDS);
    const result = await this.repository.activateLandlord(
      principal.id,
      {
        displayName: input.displayName,
        ...(input.businessName ? { businessName: input.businessName } : {}),
        contactPhone: normalizePhone(input.contactPhone),
        ...(input.contactTelegram
          ? { contactTelegram: normalizeTelegram(input.contactTelegram) }
          : {}),
      },
      now,
      trialEndsAt,
    );

    if (result.outcome === "USER_NOT_FOUND") throw accountUnavailable();
    if (result.outcome === "ROLE_REQUIRED") {
      throw new ConflictException({
        code: "ONBOARDING_ROLE_REQUIRED",
        message: "Choose an account role before completing a profile.",
      });
    }
    if (result.outcome === "ROLE_FORBIDDEN") {
      throw new ForbiddenException({
        code: "LANDLORD_ROLE_REQUIRED",
        message: "Only landlord accounts can complete a landlord profile.",
      });
    }
    if (result.outcome === "STATE_INVALID") {
      throw new ConflictException({
        code: "LANDLORD_ONBOARDING_STATE_INVALID",
        message:
          "This landlord setup is incomplete. Contact support before trying again.",
      });
    }

    const user = await this.repository.findUserState(principal.id);
    if (!user) throw accountUnavailable();
    return {
      onboarding: toOnboardingState(user),
      activation: result.activation,
      successNextPath:
        result.outcome === "ACTIVATED" ? "/landlord/listings/new" : "/landlord",
    };
  }
}

export function toOnboardingState(user: OnboardingUserRecord): OnboardingState {
  const roleSelectionComplete =
    user.role !== null && user.onboardingCompletedAt !== null;

  if (!roleSelectionComplete) {
    return {
      role: null,
      stage: "ROLE_SELECTION",
      nextPath: "/onboarding/role",
      roleSelectionComplete: false,
      profileComplete: false,
      landlordTrialActivated: false,
    };
  }

  if (user.role === UserRole.STUDENT) {
    const profileComplete = user.studentProfile !== null;
    return {
      role: user.role,
      stage: profileComplete ? "COMPLETE" : "STUDENT_PROFILE",
      nextPath: profileComplete ? "/search" : "/onboarding/role",
      roleSelectionComplete: true,
      profileComplete,
      landlordTrialActivated: false,
    };
  }

  if (user.role === UserRole.LANDLORD) {
    const profileComplete = user.landlordProfile !== null;
    const landlordTrialActivated = user.landlordEntitlement !== null;
    const complete = profileComplete && landlordTrialActivated;
    return {
      role: user.role,
      stage: complete ? "COMPLETE" : "LANDLORD_PROFILE",
      nextPath: complete ? "/landlord" : "/onboarding/landlord",
      roleSelectionComplete: true,
      profileComplete,
      landlordTrialActivated,
    };
  }

  return {
    role: UserRole.ADMIN,
    stage: "COMPLETE",
    nextPath: "/admin",
    roleSelectionComplete: true,
    profileComplete: true,
    landlordTrialActivated: false,
  };
}

function normalizePhone(value: string): string {
  return value.replace(/[\s-]/g, "");
}

function normalizeTelegram(value: string): string {
  return value.startsWith("@") ? value : `@${value}`;
}

function accountUnavailable(): UnauthorizedException {
  return new UnauthorizedException({
    code: "ACCOUNT_UNAVAILABLE",
    message: "This account is no longer available.",
  });
}
