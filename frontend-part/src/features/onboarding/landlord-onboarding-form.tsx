"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  AuthApiError,
  completeLandlordOnboarding,
  getOnboardingState,
  isAuthenticationSessionError,
  type LandlordOnboardingResult,
} from "../auth/auth-api";

export function LandlordOnboardingForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LandlordOnboardingResult | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setReady(false);
    setError(null);

    getOnboardingState()
      .then((state) => {
        if (!active) return;
        if (state.stage !== "LANDLORD_PROFILE") {
          router.replace(state.nextPath);
          return;
        }
        setReady(true);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (isAuthenticationSessionError(caught)) {
          router.replace("/login");
          return;
        }
        setError("We could not check your landlord setup. Try again.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadAttempt, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const businessName = optionalValue(formData.get("businessName"));
    const contactTelegram = optionalValue(formData.get("contactTelegram"));

    try {
      const completed = await completeLandlordOnboarding({
        displayName: String(formData.get("displayName") ?? ""),
        ...(businessName ? { businessName } : {}),
        contactPhone: String(formData.get("contactPhone") ?? ""),
        ...(contactTelegram ? { contactTelegram } : {}),
      });
      setResult(completed);
      router.replace(completed.successNextPath);
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
        <p>Checking your landlord setup…</p>
        <div className="skeleton onboarding-field-skeleton" />
        <div className="skeleton onboarding-field-skeleton" />
        <div className="skeleton onboarding-field-skeleton" />
      </div>
    );
  }

  if (error && !ready) {
    return (
      <div className="onboarding-error" role="alert">
        <h3>Landlord setup unavailable</h3>
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

  if (result) {
    const trialEnd = result.entitlement.trialEndsAt;
    return (
      <div className="onboarding-success" role="status">
        <p className="success-state">Trial active</p>
        <h3>Your landlord account is ready.</h3>
        <p>
          You can use landlord supply tools until{" "}
          {trialEnd ? (
            <time dateTime={trialEnd}>{formatPhnomPenhDate(trialEnd)}</time>
          ) : (
            "the server-provided access date"
          )}
          . Your profile and future rental data remain available after the
          trial.
        </p>
        <Link className="auth-secondary-action" href={result.successNextPath}>
          {result.successNextPath === "/landlord/listings/new"
            ? "Add your first rental"
            : "Open landlord workspace"}
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-form onboarding-form" onSubmit={handleSubmit}>
      <p className="auth-form-intro">
        These details identify you to students when you publish a rental. We do
        not mark accounts as verified without a real review.
      </p>

      <div className="form-field">
        <label htmlFor="landlord-display-name">Your name</label>
        <input
          id="landlord-display-name"
          name="displayName"
          type="text"
          autoComplete="name"
          minLength={2}
          maxLength={120}
          required
        />
      </div>
      <div className="form-field">
        <label htmlFor="landlord-business-name">
          Property or business name <span>(optional)</span>
        </label>
        <input
          id="landlord-business-name"
          name="businessName"
          type="text"
          autoComplete="organization"
          maxLength={160}
        />
      </div>
      <div className="form-field">
        <label htmlFor="landlord-phone">Contact phone</label>
        <input
          id="landlord-phone"
          name="contactPhone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="012 345 678"
          pattern="\+?[0-9][0-9\s-]{6,30}"
          maxLength={32}
          required
        />
      </div>
      <div className="form-field">
        <label htmlFor="landlord-telegram">
          Telegram username <span>(optional)</span>
        </label>
        <input
          id="landlord-telegram"
          name="contactTelegram"
          type="text"
          autoComplete="off"
          placeholder="@username"
          pattern="@?[A-Za-z0-9_]{5,32}"
          maxLength={33}
        />
      </div>

      <div className="trial-summary">
        <strong>Seven days, starting when you submit</strong>
        <p>
          The server records the exact start and end time once. Trial dates
          cannot be restarted from this form, and no payment card is required.
        </p>
      </div>

      {error ? (
        <p className="form-message is-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="auth-submit" type="submit" disabled={pending}>
        {pending
          ? "Activating your trial…"
          : "Complete profile and start trial"}
      </button>
    </form>
  );
}

function optionalValue(value: FormDataEntryValue | null): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized === "" ? undefined : normalized;
}

function formatPhnomPenhDate(value: string): string {
  return new Intl.DateTimeFormat("en-KH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Phnom_Penh",
  }).format(new Date(value));
}
