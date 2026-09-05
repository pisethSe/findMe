"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getLandlordEntitlement,
  getOnboardingState,
  isAuthenticationSessionError,
  type LandlordEntitlement,
} from "../auth/auth-api";
import { BrandMark } from "../landing/brand-mark";
import {
  formatLandlordAccessDate,
  getLandlordAccessPresentation,
} from "./landlord-access-model";

export function LandlordAccessPage() {
  const router = useRouter();
  const [entitlement, setEntitlement] = useState<LandlordEntitlement | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
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
      } catch (caught) {
        if (!active) return;
        if (isAuthenticationSessionError(caught)) {
          router.replace("/login");
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "We could not load your landlord access.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [attempt, router]);

  return (
    <main className="landlord-dashboard-page landlord-access-page" lang="en">
      <header className="dashboard-header">
        <BrandMark />
        <Link href="/landlord">Rental dashboard</Link>
      </header>

      <div className="landlord-access-shell">
        {loading ? (
          <AccessLoading />
        ) : error ? (
          <section className="landlord-access-error" role="alert">
            <h1>Access details are unavailable</h1>
            <p>{error} Your rental data has not been changed.</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </button>
          </section>
        ) : entitlement ? (
          <AccessDetails entitlement={entitlement} />
        ) : null}
      </div>
    </main>
  );
}

function AccessDetails({ entitlement }: { entitlement: LandlordEntitlement }) {
  const presentation = getLandlordAccessPresentation(entitlement);
  return (
    <article className="landlord-access-details">
      <header className="landlord-access-heading">
        <div className="landlord-access-status">
          <span
            className="dashboard-status-mark"
            data-active={entitlement.isAccessActive}
            aria-hidden="true"
          />
          <strong>{presentation.statusLabel}</strong>
        </div>
        <h1>{presentation.headline}</h1>
        <p>{presentation.summary}</p>
      </header>

      <div className="landlord-access-body">
        <section aria-labelledby="access-window-title">
          <h2 id="access-window-title">Access window</h2>
          <dl className="landlord-access-facts">
            <div>
              <dt>Current status</dt>
              <dd>{presentation.statusLabel}</dd>
            </div>
            {entitlement.isAccessActive && entitlement.remainingDays ? (
              <div>
                <dt>Time remaining</dt>
                <dd>
                  {entitlement.remainingDays}{" "}
                  {entitlement.remainingDays === 1 ? "day" : "days"}
                </dd>
              </div>
            ) : null}
            {entitlement.trialStartedAt ? (
              <div>
                <dt>Trial started</dt>
                <dd>
                  <time dateTime={entitlement.trialStartedAt}>
                    {formatLandlordAccessDate(entitlement.trialStartedAt)}
                  </time>
                </dd>
              </div>
            ) : null}
            {entitlement.accessEndsAt ? (
              <div>
                <dt>
                  {entitlement.isAccessActive
                    ? "Scheduled end"
                    : entitlement.status === "EXPIRED"
                      ? "Ended"
                      : "Access window"}
                </dt>
                <dd>
                  <time dateTime={entitlement.accessEndsAt}>
                    {formatLandlordAccessDate(entitlement.accessEndsAt)}
                  </time>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        {!entitlement.isAccessActive ? (
          <section aria-labelledby="retained-access-title">
            <h2 id="retained-access-title">What remains available</h2>
            <ul className="landlord-access-retained-list">
              <li>Read existing rentals and student inquiries</li>
              <li>Edit safe details and reduce room availability</li>
              <li>Pause, mark rented, or archive an existing rental</li>
            </ul>
            {presentation.isExpiredTrial ? (
              <p className="landlord-access-product-note">
                A paid access option is not available in the current MVP. Your
                retained data will remain ready for a future access option.
              </p>
            ) : null}
          </section>
        ) : (
          <section aria-labelledby="active-actions-title">
            <h2 id="active-actions-title">Supply actions available</h2>
            <p>
              Add a rental, upload its photos, submit it for review, and keep
              its room count accurate while this access is active.
            </p>
          </section>
        )}
      </div>

      <footer className="landlord-access-actions">
        <Link className="landlord-access-primary" href="/landlord">
          Manage existing rentals
        </Link>
        {entitlement.capabilities.canCreateListings ? (
          <Link href="/landlord/listings/new">Add a rental</Link>
        ) : (
          <Link href="/search">Browse student rentals</Link>
        )}
      </footer>
    </article>
  );
}

function AccessLoading() {
  return (
    <section
      className="landlord-access-loading"
      aria-busy="true"
      aria-live="polite"
    >
      <p>Loading your landlord access…</p>
      <div className="landlord-access-loading-heading skeleton" />
      <div className="landlord-access-loading-body skeleton" />
    </section>
  );
}
