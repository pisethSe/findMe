"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { AuthApiError, resetPassword } from "./auth-api";

export function ResetPasswordForm({ token }: { token: string | undefined }) {
  const [error, setError] = useState<string | null>(
    token ? null : "This password-reset link is missing its token.",
  );
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmPassword") ?? "");
    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }

    setPending(true);
    try {
      await resetPassword(token, password);
      window.history.replaceState({}, "", "/reset-password");
      setComplete(true);
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

  if (complete) {
    return (
      <div className="auth-success" role="status">
        <h3>Password updated</h3>
        <p>
          Existing sessions were signed out. Use your new password to return.
        </p>
        <Link className="auth-secondary-action" href="/login">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="reset-password">New password</label>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          aria-describedby="reset-password-requirements"
          disabled={!token}
          required
        />
        <p className="field-help" id="reset-password-requirements">
          Use at least 12 characters with a letter and a number.
        </p>
      </div>
      <div className="form-field">
        <label htmlFor="reset-confirm-password">Confirm new password</label>
        <input
          id="reset-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          disabled={!token}
          required
        />
      </div>

      {error ? (
        <p className="form-message is-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="auth-submit"
        type="submit"
        disabled={pending || !token}
      >
        {pending ? "Updating password…" : "Update password"}
      </button>
      <p className="auth-alternate">
        <Link href="/forgot-password">Request another reset link</Link>
      </p>
    </form>
  );
}
