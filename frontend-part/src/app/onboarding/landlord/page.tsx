import type { Metadata } from "next";

import { LandlordOnboardingForm } from "../../../features/onboarding/landlord-onboarding-form";
import { OnboardingShell } from "../../../features/onboarding/onboarding-shell";

export const metadata: Metadata = {
  title: "Set up your landlord profile",
  robots: { index: false, follow: false },
};

export default function LandlordOnboardingPage() {
  return (
    <OnboardingShell
      currentStep={2}
      title="Complete your landlord profile"
      titleKm="បំពេញប្រវត្តិម្ចាស់ផ្ទះរបស់អ្នក"
      description="Provide the contact details needed for genuine student inquiries, then begin your one-time seven-day access period."
    >
      <LandlordOnboardingForm />
    </OnboardingShell>
  );
}
