import type { Metadata } from "next";

import { OnboardingShell } from "../../../features/onboarding/onboarding-shell";
import { RoleOnboardingForm } from "../../../features/onboarding/role-onboarding-form";

export const metadata: Metadata = {
  title: "ជ្រើសរើសតួនាទីគណនី",
  robots: { index: false, follow: false },
};

export default function RoleOnboardingPage() {
  return (
    <OnboardingShell
      currentStep={1}
      title="តើអ្នកជាសិស្ស/និស្សិត ឬជាម្ចាស់ផ្ទះជួល?"
      titleLang="km"
      titleKm="ជ្រើសរើសរបៀបប្រើ FindMe"
      description="ជ្រើសរើសតួនាទីរបស់អ្នក ដើម្បីស្វែងរកបន្ទប់ជួលដោយឥតគិតថ្លៃ ឬគ្រប់គ្រងបន្ទប់ជួលរបស់អ្នក។"
    >
      <RoleOnboardingForm />
    </OnboardingShell>
  );
}
