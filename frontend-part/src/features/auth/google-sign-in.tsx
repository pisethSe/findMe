"use client";

import { useEffect, useState } from "react";

import { fetchAuthProviders, googleSignInUrl } from "./auth-api";

type GoogleProviderState = "checking" | "available" | "unavailable";

/**
 * Sign-in option shown above the email/password fields on the auth forms.
 * The button only becomes actionable when the server confirms it can complete
 * the Google flow, so users are never sent into a flow that will fail.
 */
export function GoogleSignIn({ next }: { next: string | null }) {
  const [state, setState] = useState<GoogleProviderState>("checking");

  useEffect(() => {
    let active = true;
    fetchAuthProviders()
      .then((providers) => {
        if (active) setState(providers.google ? "available" : "unavailable");
      })
      .catch(() => {
        if (active) setState("unavailable");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="auth-oauth">
      {state === "available" ? (
        <a
          className="auth-oauth-button"
          href={googleSignInUrl(next)}
          data-testid="google-signin"
        >
          Continue with Google
        </a>
      ) : (
        <button
          className="auth-oauth-button"
          type="button"
          disabled
          aria-describedby="google-signin-status"
          data-testid="google-signin"
        >
          Continue with Google
        </button>
      )}
      <p className="field-help" id="google-signin-status">
        {state === "checking"
          ? "Checking Google sign-in…"
          : state === "unavailable"
            ? "Google sign-in is not set up on this server yet. Use email and password instead."
            : null}
      </p>
      <p className="auth-divider">
        <span>Or continue with email</span>
      </p>
    </div>
  );
}
