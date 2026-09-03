import type { Metadata } from "next";

import { AuthShell } from "../../features/auth/auth-shell";
import { LoginForm } from "../../features/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      titleKm="ចូលទៅកាន់គណនីរបស់អ្នក"
      description="Return to nearby rental search and the rooms you are considering."
    >
      <LoginForm />
    </AuthShell>
  );
}
