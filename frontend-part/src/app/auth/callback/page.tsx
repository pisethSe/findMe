import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "../../../features/auth/auth-shell";
import { OAuthCallback } from "../../../features/auth/oauth-callback";

export const metadata: Metadata = {
  title: "Google sign-in",
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return (
    <AuthShell
      title="Google sign-in"
      titleKm="ចូលជាមួយ Google"
      description="Completing your sign-in and checking which onboarding step comes next."
    >
      <Suspense fallback={null}>
        <OAuthCallback />
      </Suspense>
    </AuthShell>
  );
}
