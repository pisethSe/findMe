import type { Metadata } from "next";

import { AuthShell } from "../../features/auth/auth-shell";
import { ForgotPasswordForm } from "../../features/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      titleKm="ស្នើសុំលេខសម្ងាត់ថ្មី"
      description="Recover access without revealing whether an email address is registered."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
