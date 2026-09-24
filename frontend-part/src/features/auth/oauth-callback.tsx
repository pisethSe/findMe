"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  AuthApiError,
  getPostAuthenticationPath,
  refreshSession,
} from "./auth-api";
import { oauthErrorMessage } from "./oauth-errors";
import {
  safeStudentReturnPath,
  studentPostAuthPath,
} from "./student-return-path";

/**
 * Landing point after the backend finishes (or fails) Google sign-in. On
 * success it exchanges the httpOnly refresh cookie for an access token, then
 * routes through the same onboarding state machine as password sign-in.
 */
export function OAuthCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const status = searchParams.get("status");
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (status !== "success") {
      setError(oauthErrorMessage(code));
      return;
    }

    (async () => {
      try {
        await refreshSession();
        const path = studentPostAuthPath(
          await getPostAuthenticationPath(),
          safeStudentReturnPath(next),
        );
        router.replace(path);
      } catch (caught) {
        setError(
          caught instanceof AuthApiError
            ? caught.message
            : "Check your connection and try signing in again.",
        );
      }
    })();
  }, [status, code, next, router]);

  if (error) {
    return (
      <div className="auth-form" data-testid="oauth-callback-error">
        <p className="form-message is-error" role="alert">
          {error}
        </p>
        <p className="auth-alternate">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-form" data-testid="oauth-callback-pending">
      <p>Finishing Google sign-in…</p>
    </div>
  );
}
