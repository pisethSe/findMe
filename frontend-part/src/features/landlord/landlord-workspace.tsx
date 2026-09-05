"use client";

import type {
  LandlordInquiryDto,
  LandlordListingDto,
  OffsetPageMeta,
} from "@findme/contracts";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import {
  formatLandlordAccessTiming,
  getLandlordAccessPresentation,
} from "./landlord-access-model";
import {
  AuthApiError,
  getLandlordEntitlement,
  getOnboardingState,
  isAuthenticationSessionError,
  type LandlordEntitlement,
} from "../auth/auth-api";
import { BrandMark } from "../landing/brand-mark";
import {
  listLandlordListings,
  listRecentLandlordInquiries,
  runListingCommand,
  updateListingAvailability,
  type DashboardListingCommand,
} from "./landlord-dashboard-api";
import {
  getListingStatusPresentation,
  getListingTitle,
  canEditListingFromDashboard,
  formatAvailabilityFreshness,
  listingCommandsForStatus,
  mergeListingPages,
  validateAvailabilityChange,
} from "./landlord-dashboard-model";

const RENTALS_PER_PAGE = 6;
const RECENT_INQUIRIES = 5;

interface DashboardData {
  entitlement: LandlordEntitlement;
  listings: readonly LandlordListingDto[];
  listingMeta: OffsetPageMeta;
  inquiries: readonly LandlordInquiryDto[];
  inquiryMeta: OffsetPageMeta;
}

export function LandlordWorkspace() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

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

        const entitlement = await getLandlordEntitlement();
        if (!active) return;
        const [listingPage, inquiryPage] = await Promise.all([
          listLandlordListings(1, RENTALS_PER_PAGE),
          listRecentLandlordInquiries(RECENT_INQUIRIES),
        ]);
        if (!active) return;
        setDashboard({
          entitlement,
          listings: listingPage.data,
          listingMeta: listingPage.meta,
          inquiries: inquiryPage.data,
          inquiryMeta: inquiryPage.meta,
        });
        setLoading(false);
      } catch (caught) {
        if (!active) return;
        if (isAuthenticationSessionError(caught)) {
          router.replace("/login");
          return;
        }
        setError(
          getRequestMessage(caught, "We could not load your dashboard."),
        );
        setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [loadAttempt, router]);

  async function loadMoreRentals() {
    if (!dashboard || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const nextPage = await listLandlordListings(
        dashboard.listingMeta.page + 1,
        RENTALS_PER_PAGE,
      );
      setDashboard((current) =>
        current
          ? {
              ...current,
              listings: mergeListingPages(current.listings, nextPage.data),
              listingMeta: nextPage.meta,
            }
          : current,
      );
    } catch (caught) {
      if (isAuthenticationSessionError(caught)) {
        router.replace("/login");
        return;
      }
      setMoreError(
        getRequestMessage(caught, "More rentals could not be loaded."),
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function saveAvailability(
    listing: LandlordListingDto,
    rawValue: string,
  ): Promise<LandlordListingDto> {
    if (!dashboard) throw new Error("Dashboard is unavailable.");
    const validationError = validateAvailabilityChange(
      listing,
      rawValue,
      dashboard.entitlement.capabilities.canIncreaseAvailability,
    );
    if (validationError) throw new Error(validationError);
    const updated = await updateListingAvailability(
      listing.id,
      Number(rawValue),
    );
    replaceListing(updated);
    return updated;
  }

  async function runCommand(
    listing: LandlordListingDto,
    command: DashboardListingCommand,
  ): Promise<LandlordListingDto> {
    const updated = await runListingCommand(listing.id, command);
    replaceListing(updated);
    return updated;
  }

  function replaceListing(updated: LandlordListingDto) {
    setDashboard((current) =>
      current
        ? {
            ...current,
            listings: current.listings.map((listing) =>
              listing.id === updated.id ? updated : listing,
            ),
          }
        : current,
    );
  }

  return (
    <main className="landlord-dashboard-page" lang="en">
      <header className="dashboard-header">
        <BrandMark />
        <Link href="/search">Browse student rentals</Link>
      </header>

      <div className="dashboard-shell">
        {loading ? (
          <DashboardLoading />
        ) : error ? (
          <DashboardError
            message={error}
            onRetry={() => setLoadAttempt((value) => value + 1)}
          />
        ) : dashboard ? (
          <>
            <DashboardIntro dashboard={dashboard} />
            {!dashboard.entitlement.isAccessActive ? (
              <ExpiredAccessNotice entitlement={dashboard.entitlement} />
            ) : null}

            <div className="dashboard-task-layout">
              <section
                className="dashboard-rentals"
                aria-labelledby="owned-rentals-title"
              >
                <div className="dashboard-section-heading">
                  <div>
                    <h2 id="owned-rentals-title">Your rentals</h2>
                    <p>
                      {formatCount(
                        dashboard.listingMeta.total,
                        "rental",
                        "rentals",
                      )}
                    </p>
                  </div>
                  {dashboard.entitlement.capabilities.canCreateListings ? (
                    <Link
                      className="dashboard-add-rental dashboard-add-rental-secondary"
                      href="/landlord/listings/new"
                    >
                      Add rental
                    </Link>
                  ) : null}
                </div>

                {dashboard.listings.length === 0 ? (
                  <RentalEmptyState
                    canCreate={
                      dashboard.entitlement.capabilities.canCreateListings
                    }
                  />
                ) : (
                  <div className="dashboard-listing-list">
                    {dashboard.listings.map((listing) => (
                      <RentalDashboardCard
                        key={listing.id}
                        listing={listing}
                        canIncreaseAvailability={
                          dashboard.entitlement.capabilities
                            .canIncreaseAvailability
                        }
                        canSubmit={
                          dashboard.entitlement.capabilities.canSubmitListings
                        }
                        onSaveAvailability={saveAvailability}
                        onRunCommand={runCommand}
                        onEntitlementDenied={() =>
                          setLoadAttempt((value) => value + 1)
                        }
                      />
                    ))}
                  </div>
                )}

                {moreError ? (
                  <p className="dashboard-inline-error" role="alert">
                    {moreError}
                  </p>
                ) : null}
                {dashboard.listingMeta.page <
                dashboard.listingMeta.totalPages ? (
                  <button
                    className="dashboard-load-more"
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadMoreRentals()}
                  >
                    {loadingMore ? "Loading rentals…" : "Load more rentals"}
                  </button>
                ) : null}
              </section>

              <RecentInquiries
                inquiries={dashboard.inquiries}
                total={dashboard.inquiryMeta.total}
              />
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

function DashboardIntro({ dashboard }: { dashboard: DashboardData }) {
  const { entitlement, listingMeta, inquiryMeta } = dashboard;
  const access = getLandlordAccessPresentation(entitlement);
  return (
    <section className="dashboard-intro" aria-labelledby="dashboard-title">
      <div className="dashboard-intro-copy">
        <h1 id="dashboard-title">Manage your rentals</h1>
        <p>Keep room availability accurate and follow new student inquiries.</p>
      </div>
      <div className="dashboard-access-summary">
        <div className="dashboard-access-state">
          <span
            className="dashboard-status-mark"
            data-active={entitlement.isAccessActive}
            aria-hidden="true"
          />
          <div>
            <strong>{access.statusLabel}</strong>
            <span>{formatLandlordAccessTiming(entitlement)}</span>
          </div>
        </div>
        <dl className="dashboard-totals">
          <div>
            <dt>Rentals</dt>
            <dd>{listingMeta.total}</dd>
          </div>
          <div>
            <dt>Inquiries</dt>
            <dd>{inquiryMeta.total}</dd>
          </div>
        </dl>
        {entitlement.capabilities.canCreateListings ? (
          <Link className="dashboard-add-rental" href="/landlord/listings/new">
            Add rental
          </Link>
        ) : (
          <span
            className="dashboard-add-rental dashboard-add-rental-disabled"
            aria-disabled="true"
          >
            Add rental unavailable
          </span>
        )}
      </div>
    </section>
  );
}

function ExpiredAccessNotice({
  entitlement,
}: {
  entitlement: LandlordEntitlement;
}) {
  const access = getLandlordAccessPresentation(entitlement);
  return (
    <section
      className="dashboard-access-notice"
      aria-labelledby="access-notice-title"
    >
      <div>
        <h2 id="access-notice-title">{access.headline}</h2>
        <p>{access.summary}</p>
      </div>
      <Link href="/landlord/trial">
        Review access
        <span aria-hidden="true">→</span>
      </Link>
      {entitlement.accessEndsAt ? (
        <p className="dashboard-access-ended-date">
          Ended{" "}
          <time dateTime={entitlement.accessEndsAt}>
            {formatDate(entitlement.accessEndsAt)}
          </time>
        </p>
      ) : null}
    </section>
  );
}

interface RentalCardProps {
  listing: LandlordListingDto;
  canIncreaseAvailability: boolean;
  canSubmit: boolean;
  onSaveAvailability: (
    listing: LandlordListingDto,
    rawValue: string,
  ) => Promise<LandlordListingDto>;
  onRunCommand: (
    listing: LandlordListingDto,
    command: DashboardListingCommand,
  ) => Promise<LandlordListingDto>;
  onEntitlementDenied: () => void;
}

function RentalDashboardCard({
  listing,
  canIncreaseAvailability,
  canSubmit,
  onSaveAvailability,
  onRunCommand,
  onEntitlementDenied,
}: RentalCardProps) {
  const [availability, setAvailability] = useState(
    String(listing.availableUnits),
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [confirming, setConfirming] = useState<DashboardListingCommand | null>(
    null,
  );
  const status = getListingStatusPresentation(listing.status);
  const image = listing.images.find(
    (candidate) => candidate.status === "READY",
  );
  const commands = listingCommandsForStatus(listing.status).filter(
    (command) => command !== "SUBMIT" || canSubmit,
  );
  const canEdit = canEditListingFromDashboard(listing.status);
  const availabilityError = validateAvailabilityChange(
    listing,
    availability,
    canIncreaseAvailability,
  );
  const availabilityChanged = availability !== String(listing.availableUnits);

  useEffect(() => {
    setAvailability(String(listing.availableUnits));
  }, [listing.availableUnits]);

  async function submitAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (availabilityError || !availabilityChanged || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const updated = await onSaveAvailability(listing, availability);
      setAvailability(String(updated.availableUnits));
      setFeedback({ tone: "success", message: "Availability updated." });
    } catch (caught) {
      if (isEntitlementDenied(caught)) onEntitlementDenied();
      setFeedback({
        tone: "error",
        message: getRequestMessage(
          caught,
          "Availability could not be updated.",
        ),
      });
    } finally {
      setBusy(false);
    }
  }

  async function executeCommand(command: DashboardListingCommand) {
    setBusy(true);
    setFeedback(null);
    try {
      await onRunCommand(listing, command);
      setFeedback({
        tone: "success",
        message: commandSuccessMessage(command),
      });
      setConfirming(null);
    } catch (caught) {
      if (isEntitlementDenied(caught)) onEntitlementDenied();
      setFeedback({
        tone: "error",
        message: getRequestMessage(caught, "The rental could not be updated."),
      });
    } finally {
      setBusy(false);
    }
  }

  function requestCommand(command: DashboardListingCommand) {
    if (command === "MARK_RENTED" || command === "ARCHIVE") {
      setFeedback(null);
      setConfirming(command);
      return;
    }
    void executeCommand(command);
  }

  return (
    <article className="dashboard-rental-card">
      <div className="dashboard-rental-media">
        {image ? (
          <Image
            src={image.publicUrl}
            fill
            sizes="(max-width: 640px) calc(100vw - 28px), 190px"
            alt={
              image.altTextEn ||
              image.altTextKm ||
              `${getListingTitle(listing)} rental`
            }
          />
        ) : (
          <div
            className="dashboard-rental-placeholder"
            aria-label="No rental photo"
          >
            <span aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="dashboard-rental-body">
        <div className="dashboard-rental-heading">
          <div>
            <div className="dashboard-listing-status" data-tone={status.tone}>
              <span aria-hidden="true" />
              {status.label} · {status.detail}
            </div>
            <h3 lang={listing.titleKm ? "km" : "en"}>
              {getListingTitle(listing)}
            </h3>
            <p className="dashboard-rental-address">
              {listing.property.addressLine}, {listing.property.city}
            </p>
          </div>
          <div className="dashboard-rental-price">
            <strong>
              {formatMoney(listing.monthlyPrice, listing.currency)}
            </strong>
            <span>per month</span>
          </div>
        </div>

        <div className="dashboard-rental-management">
          <form onSubmit={submitAvailability} noValidate>
            <label htmlFor={`availability-${listing.id}`}>
              Available rooms
            </label>
            <div className="dashboard-availability-row">
              <input
                id={`availability-${listing.id}`}
                type="number"
                min="0"
                max={listing.property.totalUnits}
                step="1"
                inputMode="numeric"
                value={availability}
                disabled={busy || listing.status === "ARCHIVED"}
                aria-describedby={`availability-help-${listing.id}`}
                aria-invalid={availabilityChanged && Boolean(availabilityError)}
                onChange={(event) => {
                  setAvailability(event.target.value);
                  setFeedback(null);
                }}
              />
              <span>of {listing.property.totalUnits}</span>
              <button
                type="submit"
                disabled={
                  busy ||
                  !availabilityChanged ||
                  Boolean(availabilityError) ||
                  listing.status === "ARCHIVED"
                }
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
            <p id={`availability-help-${listing.id}`}>
              {availabilityChanged && availabilityError
                ? availabilityError
                : `${formatAvailabilityFreshness(
                    listing.availabilityConfirmedAt,
                  )}${
                    canIncreaseAvailability
                      ? ""
                      : " You may keep or reduce the current room count."
                  }`}
            </p>
          </form>

          {canEdit || commands.length > 0 ? (
            <div
              className="dashboard-rental-actions"
              aria-label="Rental actions"
            >
              {canEdit ? (
                <Link href={`/landlord/listings/${listing.id}/edit`}>
                  Edit details
                </Link>
              ) : null}
              {commands.map((command) => (
                <button
                  key={command}
                  type="button"
                  data-danger={
                    command === "ARCHIVE" || command === "MARK_RENTED"
                  }
                  disabled={busy}
                  onClick={() => requestCommand(command)}
                >
                  {commandLabel(command)}
                </button>
              ))}
            </div>
          ) : (
            <p className="dashboard-read-only">
              This archived rental is read only.
            </p>
          )}
        </div>

        {confirming ? (
          <div
            className="dashboard-confirmation"
            role="group"
            aria-label="Confirm rental update"
          >
            <p>{confirmationMessage(confirming)}</p>
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void executeCommand(confirming)}
              >
                {busy
                  ? "Updating…"
                  : `Yes, ${commandLabel(confirming).toLowerCase()}`}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {feedback ? (
          <p
            className="dashboard-card-feedback"
            data-tone={feedback.tone}
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function RentalEmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="dashboard-empty-state">
      <div className="dashboard-empty-illustration" aria-hidden="true">
        <span />
        <span />
      </div>
      <h3>No rentals yet</h3>
      <p>
        {canCreate
          ? "Add your first rental with its location, room count, price, and photos. It stays private until you submit it for review."
          : "Your existing rentals will remain visible here. New rentals cannot be added while access is inactive."}
      </p>
      {canCreate ? (
        <Link className="dashboard-add-rental" href="/landlord/listings/new">
          Add your first rental
        </Link>
      ) : (
        <Link className="dashboard-text-link" href="/landlord/trial">
          Review access
        </Link>
      )}
    </div>
  );
}

function RecentInquiries({
  inquiries,
  total,
}: {
  inquiries: readonly LandlordInquiryDto[];
  total: number;
}) {
  return (
    <aside
      className="dashboard-inquiries"
      aria-labelledby="recent-inquiries-title"
    >
      <div className="dashboard-section-heading">
        <div>
          <h2 id="recent-inquiries-title">Recent inquiries</h2>
          <p>{formatCount(total, "inquiry", "inquiries")}</p>
        </div>
      </div>
      {inquiries.length === 0 ? (
        <div className="dashboard-inquiry-empty">
          <h3>No student inquiries yet</h3>
          <p>
            Messages about your published rentals will appear here. Keep room
            availability current so students see accurate information.
          </p>
        </div>
      ) : (
        <ol className="dashboard-inquiry-list">
          {inquiries.map((inquiry) => (
            <li key={inquiry.id}>
              <div className="dashboard-inquiry-meta">
                <strong>{inquiry.student.displayName}</strong>
                <time dateTime={inquiry.createdAt}>
                  {formatDate(inquiry.createdAt)}
                </time>
              </div>
              <p
                className="dashboard-inquiry-rental"
                lang={inquiry.listing.titleKm ? "km" : "en"}
              >
                {inquiry.listing.titleKm ||
                  inquiry.listing.titleEn ||
                  inquiry.listing.propertyName}
              </p>
              <details className="dashboard-inquiry-details">
                <summary>
                  <span>{inquiry.message}</span>
                  <strong className="dashboard-inquiry-open-label">
                    Read full message
                  </strong>
                  <strong className="dashboard-inquiry-close-label">
                    Hide full message
                  </strong>
                </summary>
                <p>{inquiry.message}</p>
              </details>
              <span
                className="dashboard-inquiry-status"
                data-new={inquiry.status === "NEW"}
              >
                {formatInquiryStatus(inquiry.status)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function DashboardLoading() {
  return (
    <section className="dashboard-loading" aria-busy="true" aria-live="polite">
      <p>Loading your rental dashboard…</p>
      <div className="dashboard-loading-intro skeleton" />
      <div className="dashboard-loading-grid">
        <div>
          <div className="dashboard-loading-line skeleton" />
          <div className="dashboard-loading-card skeleton" />
          <div className="dashboard-loading-card skeleton" />
        </div>
        <div className="dashboard-loading-side skeleton" />
      </div>
    </section>
  );
}

function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section
      className="dashboard-error"
      role="alert"
      aria-labelledby="dashboard-error-title"
    >
      <h1 id="dashboard-error-title">Your dashboard is unavailable</h1>
      <p>{message} Your rental data has not been changed.</p>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </section>
  );
}

function formatMoney(value: number, currency: "USD" | "KHR"): string {
  return new Intl.NumberFormat("en-KH", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KHR" ? 0 : 2,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-KH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Phnom_Penh",
  }).format(new Date(value));
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${new Intl.NumberFormat("en-KH").format(value)} ${
    value === 1 ? singular : plural
  }`;
}

function formatInquiryStatus(status: LandlordInquiryDto["status"]): string {
  switch (status) {
    case "NEW":
      return "New";
    case "READ":
      return "Read";
    case "RESPONDED":
      return "Responded";
    case "CLOSED":
      return "Closed";
  }
}

function commandLabel(command: DashboardListingCommand): string {
  switch (command) {
    case "SUBMIT":
      return "Submit for review";
    case "PAUSE":
      return "Pause listing";
    case "MARK_RENTED":
      return "Mark rented";
    case "ARCHIVE":
      return "Archive";
  }
}

function commandSuccessMessage(command: DashboardListingCommand): string {
  switch (command) {
    case "SUBMIT":
      return "Rental submitted for review.";
    case "PAUSE":
      return "Rental paused and hidden from public search.";
    case "MARK_RENTED":
      return "Rental marked as rented.";
    case "ARCHIVE":
      return "Rental archived.";
  }
}

function confirmationMessage(command: DashboardListingCommand): string {
  if (command === "MARK_RENTED") {
    return "Mark this rental as rented? It will be hidden from student search and availability will become zero.";
  }
  return "Archive this rental? It will become read only and stay out of student search.";
}

function getRequestMessage(caught: unknown, fallback: string): string {
  if (caught instanceof AuthApiError || caught instanceof Error) {
    return caught.message;
  }
  return fallback;
}

function isEntitlementDenied(caught: unknown): boolean {
  return (
    caught instanceof AuthApiError &&
    caught.code === "LANDLORD_ENTITLEMENT_REQUIRED"
  );
}
