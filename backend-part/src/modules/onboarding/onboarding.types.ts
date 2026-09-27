import type {
  AccountStatus,
  EntitlementSource,
  EntitlementStatus,
  UserRole,
  VerificationStatus,
} from "../../generated/prisma/client.js";

export type OnboardingStage =
  "ROLE_SELECTION" | "STUDENT_PROFILE" | "LANDLORD_PROFILE" | "COMPLETE";

export interface OnboardingUserRecord {
  id: string;
  role: UserRole | null;
  accountStatus: AccountStatus;
  onboardingCompletedAt: Date | null;
  deletedAt: Date | null;
  studentProfile: {
    displayName: string;
    institutionId: string | null;
    preferredRadiusMeters: number | null;
    institution: {
      id: string;
      slug: string;
      nameEn: string;
      nameKm: string;
      isActive: boolean;
    } | null;
  } | null;
  landlordProfile: { userId: string } | null;
  landlordEntitlement: { landlordId: string } | null;
}

/**
 * The student's saved search default. The server derives the canonical campus
 * identity so the browser can build a valid search URL without trusting a
 * client-supplied institution id.
 */
export interface StudentPreferenceRecord {
  institutionId: string;
  institutionSlug: string;
  institutionNameEn: string;
  institutionNameKm: string;
  preferredRadiusMeters: number | null;
}

export interface OnboardingState {
  role: UserRole | null;
  stage: OnboardingStage;
  nextPath:
    | "/onboarding/role"
    | "/onboarding/landlord"
    | "/"
    | "/search"
    | "/landlord"
    | "/admin";
  roleSelectionComplete: boolean;
  profileComplete: boolean;
  landlordTrialActivated: boolean;
  studentPreference: StudentPreferenceRecord | null;
}

export interface LandlordProfileRecord {
  userId: string;
  displayName: string;
  businessName: string | null;
  contactPhone: string;
  contactTelegram: string | null;
  verificationStatus: VerificationStatus;
}

export interface LandlordEntitlementRecord {
  landlordId: string;
  status: EntitlementStatus;
  source: EntitlementSource;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  accessEndsAt: Date | null;
}

export interface LandlordActivationRecord {
  profile: LandlordProfileRecord;
  entitlement: LandlordEntitlementRecord;
}
