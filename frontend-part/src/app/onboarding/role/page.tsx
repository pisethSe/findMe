import type { Metadata } from "next";

import { OnboardingShell } from "../../../features/onboarding/onboarding-shell";
import { RoleOnboardingForm } from "../../../features/onboarding/role-onboarding-form";

export const metadata: Metadata = {
  title: "Choose your account role",
  robots: { index: false, follow: false },
};

export default function RoleOnboardingPage() {
  return (
    <OnboardingShell
      currentStep={1}
      title="Choose how you use FindMe"
      titleKm="ជ្រើសរើសរបៀបប្រើ FindMe"
      description="Your role keeps student discovery separate from rental management and determines which protected tools your account can use."
    >
      <RoleOnboardingForm />
    </OnboardingShell>
  );
}
