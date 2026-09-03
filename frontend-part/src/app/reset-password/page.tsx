import type { Metadata } from "next";

import { AuthShell } from "../../features/auth/auth-shell";
import { ResetPasswordForm } from "../../features/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

interface ResetPasswordPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const value = (await searchParams).token;
  const token = Array.isArray(value) ? value[0] : value;

  return (
    <AuthShell
      title="Choose a new password"
      titleKm="កំណត់លេខសម្ងាត់ថ្មី"
      description="A successful reset signs out existing sessions so only the new password can be used."
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
