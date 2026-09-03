"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  AuthApiError,
  getOnboardingState,
  isAuthenticationSessionError,
  selectRole,
} from "../auth/auth-api";

type SelectableRole = "STUDENT" | "LANDLORD";

export function RoleOnboardingForm() {
  const router = useRouter();
  const [role, setRole] = useState<SelectableRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setReady(false);
    setError(null);

    getOnboardingState()
      .then((state) => {
        if (!active) return;
        if (
          state.stage !== "ROLE_SELECTION" &&
          state.stage !== "STUDENT_PROFILE"
        ) {
          router.replace(state.nextPath);
          return;
        }
        if (state.stage === "STUDENT_PROFILE") setRole("STUDENT");
        setReady(true);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (isAuthenticationSessionError(caught)) {
          router.replace("/login");
          return;
        }
        setError("We could not check your account. Try again.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadAttempt, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role) {
      setError("Choose Student or Landlord to continue.");
      return;
    }

    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);

    try {
      const state = await selectRole({
        role,
        ...(role === "STUDENT"
          ? { displayName: String(formData.get("displayName") ?? "") }
          : {}),
      });
      router.replace(state.nextPath);
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

  if (loading) {
    return (
      <div className="onboarding-loading" aria-busy="true" aria-live="polite">
        <p>Checking your account…</p>
        <div className="skeleton onboarding-choice-skeleton" />
        <div className="skeleton onboarding-choice-skeleton" />
      </div>
    );
  }

  if (error && !ready) {
    return (
      <div className="onboarding-error" role="alert">
        <h3>Account check failed</h3>
        <p>{error}</p>
        <button
          type="button"
          onClick={() => setLoadAttempt((value) => value + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <form className="auth-form onboarding-form" onSubmit={handleSubmit}>
      <fieldset className="role-options" disabled={pending}>
        <legend>How will you use FindMe?</legend>
        <label className="role-option" data-selected={role === "STUDENT"}>
          <input
            type="radio"
            name="role"
            value="STUDENT"
            checked={role === "STUDENT"}
            onChange={() => setRole("STUDENT")}
          />
          <span>
            <strong>Student</strong>
            <small>
              Search near your university, compare rooms, and save suitable
              rentals.
            </small>
          </span>
        </label>
        <label className="role-option" data-selected={role === "LANDLORD"}>
          <input
            type="radio"
            name="role"
            value="LANDLORD"
            checked={role === "LANDLORD"}
            onChange={() => setRole("LANDLORD")}
          />
          <span>
            <strong>Landlord</strong>
            <small>
              Add and maintain accurate rental supply for nearby students.
            </small>
          </span>
        </label>
      </fieldset>

      {role === "STUDENT" ? (
        <div className="form-field onboarding-profile-field">
          <label htmlFor="student-display-name">Your display name</label>
          <input
            id="student-display-name"
            name="displayName"
            type="text"
            autoComplete="name"
            minLength={2}
            maxLength={120}
            required
          />
          <p className="field-help">
            Used on your private account. It is not shown with your saved
            rentals.
          </p>
        </div>
      ) : null}

      {role === "LANDLORD" ? (
        <p className="trial-note">
          Your one-time seven-day trial starts only after you complete the
          landlord profile on the next step. No payment card is required.
        </p>
      ) : null}

      {error ? (
        <p className="form-message is-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="auth-submit" type="submit" disabled={pending || !role}>
        {pending
          ? "Saving your choice…"
          : role === "LANDLORD"
            ? "Continue as landlord"
            : role === "STUDENT"
              ? "Finish student setup"
              : "Choose a role to continue"}
      </button>
      <p className="role-commitment">
        This choice controls account permissions and cannot be switched through
        self-service onboarding.
      </p>
    </form>
  );
}
