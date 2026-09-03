"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  AuthApiError,
  getLandlordEntitlement,
  getOnboardingState,
  isAuthenticationSessionError,
  type LandlordEntitlement,
} from "../auth/auth-api";
import { BrandMark } from "../landing/brand-mark";

export function LandlordWorkspace() {
  const router = useRouter();
  const [entitlement, setEntitlement] = useState<LandlordEntitlement | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const onboarding = await getOnboardingState();
        if (!active) return;
        if (onboarding.nextPath !== "/landlord") {
          router.replace(onboarding.nextPath);
          return;
        }
        const access = await getLandlordEntitlement();
        if (!active) return;
        setEntitlement(access);
        setLoading(false);
      } catch (caught) {
        if (!active) return;
        if (isAuthenticationSessionError(caught)) {
          router.replace("/login");
          return;
        }
        setError(
          caught instanceof AuthApiError
            ? caught.message
            : "We could not load your landlord access.",
        );
        setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [loadAttempt, router]);

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <BrandMark />
        <Link href="/search">Browse student rentals</Link>
      </header>

      <section className="workspace-content" aria-labelledby="workspace-title">
        <div className="workspace-heading">
          <div>
            <p>Landlord workspace</p>
            <h1 id="workspace-title">Keep your rental supply current.</h1>
          </div>
          {entitlement ? (
            <span
              className="access-status"
              data-active={entitlement.isAccessActive}
            >
              {entitlement.isAccessActive ? "Access active" : "Access ended"}
            </span>
          ) : null}
        </div>

        {loading ? (
          <div
            className="workspace-loading"
            aria-busy="true"
            aria-live="polite"
          >
            <p>Checking your landlord access…</p>
            <div className="skeleton workspace-panel-skeleton" />
          </div>
        ) : error ? (
          <div className="workspace-error" role="alert">
            <h2>Landlord access unavailable</h2>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setLoadAttempt((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : entitlement ? (
          <div className="workspace-grid">
            <section className="access-panel" aria-labelledby="access-title">
              <div>
                <p>
                  {entitlement.source === "TRIAL"
                    ? "Seven-day trial"
                    : "Landlord access"}
                </p>
                <h2 id="access-title">
                  {entitlement.isAccessActive
                    ? `${entitlement.remainingDays ?? 0} days remaining`
                    : "Your access period has ended"}
                </h2>
              </div>
              {entitlement.accessEndsAt ? (
                <p>
                  {entitlement.isAccessActive ? "Access ends" : "Access ended"}{" "}
                  <time dateTime={entitlement.accessEndsAt}>
                    {formatPhnomPenhDate(entitlement.accessEndsAt)}
                  </time>
                  .
                </p>
              ) : (
                <p>Your current access has no scheduled end date.</p>
              )}
            </section>

            <section
              className="workspace-next"
              aria-labelledby="workspace-next-title"
            >
              <h2 id="workspace-next-title">
                Your account foundation is ready
              </h2>
              <p>
                Listing creation and inquiry management will use this
                server-verified access state. Your data remains readable if
                access expires.
              </p>
              <dl>
                <div>
                  <dt>Profile</dt>
                  <dd>Complete</dd>
                </div>
                <div>
                  <dt>Create and publish</dt>
                  <dd>
                    {entitlement.capabilities.canCreateListings
                      ? "Allowed"
                      : "Restricted"}
                  </dd>
                </div>
                <div>
                  <dt>Existing rental data</dt>
                  <dd>Readable</dd>
                </div>
              </dl>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function formatPhnomPenhDate(value: string): string {
  return new Intl.DateTimeFormat("en-KH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Phnom_Penh",
  }).format(new Date(value));
}
