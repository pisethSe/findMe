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
  StudentPreferenceRecord,
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

    // Campus, radius and the room budget are student-only defaults. A landlord
    // request must never carry them, so a cross-role client cannot seed supply
    // state.
    if (input.role === "LANDLORD") {
      const studentOnlyField = (
        [
          "institutionId",
          "preferredRadiusMeters",
          "preferredMinPrice",
          "preferredMaxPrice",
        ] as const
      ).find((field) => input[field] !== undefined);
      if (studentOnlyField) {
        throw new BadRequestException({
          code: "ROLE_PROFILE_FIELDS_INVALID",
          message:
            "Student profile preferences are not accepted for landlords.",
          fields: [
            {
              field: studentOnlyField,
              message: "Remove this field when continuing as a landlord.",
            },
          ],
        });
      }
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

    if (
      input.preferredMinPrice !== undefined &&
      input.preferredMaxPrice !== undefined &&
      input.preferredMinPrice > input.preferredMaxPrice
    ) {
      throw new BadRequestException({
        code: "STUDENT_BUDGET_RANGE_INVALID",
        message: "The minimum room budget cannot exceed the maximum.",
        fields: [
          {
            field: "preferredMinPrice",
            message: "Choose a range where the minimum is at most the maximum.",
          },
        ],
      });
    }

    // The server resolves the campus so an inactive, unknown, or foreign id
    // cannot become a student's saved search origin.
    if (input.institutionId) {
      const institution = await this.repository.findActiveInstitution(
        input.institutionId,
      );
      if (!institution) throw institutionUnavailable();
    }

    const role =
      input.role === "STUDENT" ? UserRole.STUDENT : UserRole.LANDLORD;
    const result = await this.repository.selectRole(
      userId,
      role,
      role === UserRole.STUDENT && input.displayName
        ? {
            displayName: input.displayName,
            ...(input.institutionId
              ? { institutionId: input.institutionId }
              : {}),
            ...(input.preferredRadiusMeters !== undefined
              ? { preferredRadiusMeters: input.preferredRadiusMeters }
              : {}),
            ...(input.preferredMinPrice !== undefined
              ? { preferredMinPrice: input.preferredMinPrice }
              : {}),
            ...(input.preferredMaxPrice !== undefined
              ? { preferredMaxPrice: input.preferredMaxPrice }
              : {}),
          }
        : undefined,
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
    successNextPath: "/landlord";
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
      // First-time landlords land on the plain dashboard, whose guided empty
      // state walks them through the first listing instead of forcing the
      // listing wizard open.
      successNextPath: "/landlord",
    };
  }
}

export function toOnboardingState(user: OnboardingUserRecord): OnboardingState {
  const roleSelectionComplete =
    user.role !== null && user.onboardingCompletedAt !== null;
  const studentPreference = toStudentPreference(user);

  if (!roleSelectionComplete) {
    return {
      role: null,
      stage: "ROLE_SELECTION",
      nextPath: "/onboarding/role",
      roleSelectionComplete: false,
      profileComplete: false,
      landlordTrialActivated: false,
      studentPreference: null,
    };
  }

  if (user.role === UserRole.STUDENT) {
    const profileComplete = user.studentProfile !== null;
    return {
      role: user.role,
      stage: profileComplete ? "COMPLETE" : "STUDENT_PROFILE",
      nextPath: profileComplete ? "/" : "/onboarding/role",
      roleSelectionComplete: true,
      profileComplete,
      landlordTrialActivated: false,
      studentPreference,
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
      studentPreference: null,
    };
  }

  return {
    role: UserRole.ADMIN,
    stage: "COMPLETE",
    nextPath: "/admin",
    roleSelectionComplete: true,
    profileComplete: true,
    landlordTrialActivated: false,
    studentPreference: null,
  };
}

/**
 * Only an active campus the student actually selected is returned. A missing,
 * inactive, or deleted institution leaves the student without a saved campus,
 * and the browser falls back to its normal institution picker.
 */
function toStudentPreference(
  user: OnboardingUserRecord,
): StudentPreferenceRecord | null {
  const profile = user.studentProfile;
  const institution = profile?.institution;
  if (!profile || !institution || !institution.isActive) return null;
  return {
    institutionId: institution.id,
    institutionSlug: institution.slug,
    institutionNameEn: institution.nameEn,
    institutionNameKm: institution.nameKm,
    preferredRadiusMeters: profile.preferredRadiusMeters,
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

function institutionUnavailable(): BadRequestException {
  return new BadRequestException({
    code: "STUDENT_INSTITUTION_INVALID",
    message: "Choose a university or college that is currently active.",
    fields: [
      {
        field: "institutionId",
        message: "Select your university or college from the list.",
      },
    ],
  });
}
