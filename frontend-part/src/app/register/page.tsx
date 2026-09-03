import type { Metadata } from "next";

import { AuthShell } from "../../features/auth/auth-shell";
import { RegisterForm } from "../../features/auth/register-form";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create an account"
      titleKm="បង្កើតគណនី FindMe"
      description="Set up a private account before choosing whether you are searching as a student or managing rentals as a landlord."
    >
      <RegisterForm />
    </AuthShell>
  );
}
