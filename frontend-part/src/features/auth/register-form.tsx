"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AuthApiError, register } from "./auth-api";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      await register({
        email: String(formData.get("email") ?? ""),
        password,
        preferredLocale: formData.get("preferredLocale") === "EN" ? "EN" : "KM",
      });
      router.replace("/search?university=rupp");
    } catch (caught) {
      setError(
        caught instanceof AuthApiError
          ? caught.message
          : "Check your connection and try creating the account again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="register-email">Email address</label>
        <input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
      </div>
      <div className="form-field">
        <label htmlFor="register-language">Preferred language</label>
        <select id="register-language" name="preferredLocale" defaultValue="KM">
          <option value="KM">ភាសាខ្មែរ (Khmer)</option>
          <option value="EN">English</option>
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          aria-describedby="password-requirements"
          required
        />
        <p className="field-help" id="password-requirements">
          Use at least 12 characters with a letter and a number.
        </p>
      </div>
      <div className="form-field">
        <label htmlFor="register-confirm-password">Confirm password</label>
        <input
          id="register-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </div>

      {error ? (
        <p className="form-message is-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="auth-submit" type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="auth-terms">
        You will choose Student or Landlord during the next account step. Admin
        access is never self-assigned.
      </p>
      <p className="auth-alternate">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
