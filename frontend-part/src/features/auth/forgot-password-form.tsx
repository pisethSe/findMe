"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { AuthApiError, requestPasswordReset } from "./auth-api";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);

    try {
      const result = await requestPasswordReset(
        String(formData.get("email") ?? ""),
      );
      setAccepted(result.accepted);
      setResetToken(result.developmentResetToken ?? null);
    } catch (caught) {
      setError(
        caught instanceof AuthApiError
          ? caught.message
          : "Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (accepted) {
    return (
      <div className="auth-success" role="status">
        <h3>Check your reset instructions</h3>
        <p>
          If an active account uses that email, FindMe has prepared a
          password-reset request.
        </p>
        {resetToken ? (
          <p className="development-reset">
            Local development only:{" "}
            <Link
              href={`/reset-password?token=${encodeURIComponent(resetToken)}`}
            >
              open the reset form
            </Link>
            .
          </p>
        ) : null}
        <Link className="auth-secondary-action" href="/login">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <p className="auth-form-intro">
        Enter the email used for your account. The response stays the same even
        when an address is not registered.
      </p>
      <div className="form-field">
        <label htmlFor="forgot-email">Email address</label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
      </div>

      {error ? (
        <p className="form-message is-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="auth-submit" type="submit" disabled={pending}>
        {pending ? "Preparing request…" : "Reset password"}
      </button>
      <p className="auth-alternate">
        Remembered it? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
