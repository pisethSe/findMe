import type { Metadata } from "next";

import { AuthShell } from "../../features/auth/auth-shell";
import { RegisterForm } from "../../features/auth/register-form";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell
      title="Create an account"
      titleKm="បង្កើតគណនី FindMe"
      description="Set up a private account before choosing whether you are searching as a student or managing rentals as a landlord."
    >
      <RegisterForm
        returnTo={typeof params.next === "string" ? params.next : null}
      />
    </AuthShell>
  );
}
