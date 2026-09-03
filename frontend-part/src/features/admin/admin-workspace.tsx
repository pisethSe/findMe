"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getOnboardingState,
  isAuthenticationSessionError,
} from "../auth/auth-api";
import { BrandMark } from "../landing/brand-mark";

export function AdminWorkspace() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError(null);

    getOnboardingState()
      .then((state) => {
        if (!active) return;
        if (state.nextPath !== "/admin") {
          router.replace(state.nextPath);
          return;
        }
        setReady(true);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (isAuthenticationSessionError(caught)) {
          router.replace("/login");
          return;
        }
        setError("We could not confirm your administration access.");
      });

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

      <section className="workspace-content" aria-labelledby="admin-title">
        <div className="workspace-heading">
          <div>
            <p>Administration</p>
            <h1 id="admin-title">Keep FindMe trustworthy and current.</h1>
          </div>
          {ready ? (
            <span className="access-status" data-active="true">
              Admin access
            </span>
          ) : null}
        </div>

        {!ready && !error ? (
          <div
            className="workspace-loading"
            aria-busy="true"
            aria-live="polite"
          >
            <p>Checking administration access…</p>
            <div className="skeleton workspace-panel-skeleton" />
          </div>
        ) : error ? (
          <div className="workspace-error" role="alert">
            <h2>Administration access unavailable</h2>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setLoadAttempt((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : (
          <section
            className="admin-foundation"
            aria-labelledby="admin-ready-title"
          >
            <h2 id="admin-ready-title">Your protected workspace is ready</h2>
            <p>
              Moderation, institution, user, and report tools will use this
              server-verified Admin role. Admin access is never available
              through self-service onboarding.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
