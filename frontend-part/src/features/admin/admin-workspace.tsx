"use client";

import type { AdminPendingListingDto, OffsetPageMeta } from "@findme/contracts";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getOnboardingState,
  isAuthenticationSessionError,
} from "../auth/auth-api";
import { BrandMark } from "../landing/brand-mark";
import {
  approveListing,
  listPendingListings,
  rejectListing,
} from "./admin-moderation-api";
import {
  MODERATION_PAGE_SIZE,
  pageAfterModerationDecision,
} from "./admin-moderation-model";

type ModerationAction = "approve" | "reject";

export function AdminWorkspace() {
  const router = useRouter();
  const [listings, setListings] = useState<
    readonly AdminPendingListingDto[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [queuePage, setQueuePage] = useState(1);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [workingAction, setWorkingAction] = useState<{
    listingId: string;
    action: ModerationAction;
  } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setListings(null);
    setMeta(null);
    setError(null);

    void (async () => {
      try {
        const state = await getOnboardingState();
        if (!active) return;
        if (state.nextPath !== "/admin") {
          router.replace(state.nextPath);
          return;
        }
        const queue = await listPendingListings(
          queuePage,
          MODERATION_PAGE_SIZE,
        );
        if (active) {
          const lastPage = Math.max(queue.meta.totalPages, 1);
          if (queuePage > lastPage) {
            setQueuePage(lastPage);
            return;
          }
          setListings(queue.data);
          setMeta(queue.meta);
        }
      } catch (caught) {
        if (!active) return;
        if (isAuthenticationSessionError(caught)) {
          router.replace("/login");
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "We could not load the moderation queue.",
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [loadAttempt, queuePage, router]);

  function reloadAfterDecision(currentPageCount: number) {
    const nextPage = pageAfterModerationDecision(queuePage, currentPageCount);
    if (nextPage !== queuePage) {
      setQueuePage(nextPage);
      return;
    }
    setLoadAttempt((current) => current + 1);
  }

  async function approve(listing: AdminPendingListingDto) {
    if (
      !window.confirm(
        `Publish “${listing.titleEn ?? listing.titleKm ?? listing.property.name}” for student search?`,
      )
    ) {
      return;
    }
    setWorkingAction({ listingId: listing.id, action: "approve" });
    setActionError(null);
    setSuccess(null);
    try {
      await approveListing(listing.id);
      setSuccess("The rental is published and public search was refreshed.");
      reloadAfterDecision(listings?.length ?? 0);
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "The rental could not be approved.",
      );
    } finally {
      setWorkingAction(null);
    }
  }

  async function reject(listing: AdminPendingListingDto) {
    const moderationNote = notes[listing.id]?.trim() ?? "";
    if (moderationNote.length < 3) {
      setActionError(
        "Enter a clear correction note before rejecting a rental.",
      );
      return;
    }
    if (
      !window.confirm(
        `Reject “${listing.titleEn ?? listing.titleKm ?? listing.property.name}” and return it to the landlord?`,
      )
    ) {
      return;
    }
    setWorkingAction({ listingId: listing.id, action: "reject" });
    setActionError(null);
    setSuccess(null);
    try {
      await rejectListing(listing.id, moderationNote);
      setSuccess("The rental was rejected with the correction note saved.");
      reloadAfterDecision(listings?.length ?? 0);
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "The rental could not be rejected.",
      );
    } finally {
      setWorkingAction(null);
    }
  }

  return (
    <main className="workspace-page admin-workspace-page" lang="en">
      <header className="workspace-header">
        <BrandMark />
        <Link href="/search">Browse student rentals</Link>
      </header>

      <section className="workspace-content" aria-labelledby="admin-title">
        <div className="workspace-heading">
          <div>
            <p>Administration</p>
            <h1 id="admin-title">Review rentals before students see them.</h1>
          </div>
          {listings ? (
            <span className="access-status" data-active="true">
              Admin access
            </span>
          ) : null}
        </div>

        {!listings && !error ? (
          <div
            className="workspace-loading"
            aria-busy="true"
            aria-live="polite"
          >
            <p>Loading the protected moderation queue…</p>
            <div className="skeleton workspace-panel-skeleton" />
          </div>
        ) : error ? (
          <div className="workspace-error" role="alert">
            <h2>Moderation queue unavailable</h2>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setLoadAttempt((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : listings ? (
          <section className="moderation-queue" aria-labelledby="queue-title">
            <div className="moderation-queue-heading">
              <div>
                <h2 id="queue-title">Pending rentals</h2>
                <p>
                  Check the content, property pin, photos, owner, availability,
                  and price before deciding.
                </p>
              </div>
              <strong>{meta?.total ?? listings.length} waiting</strong>
            </div>

            {actionError ? (
              <p
                className="moderation-action-message"
                data-error="true"
                role="alert"
              >
                {actionError}
              </p>
            ) : null}
            {success ? (
              <p className="moderation-action-message" role="status">
                {success}
              </p>
            ) : null}

            {listings.length === 0 ? (
              <div className="moderation-empty">
                <h3>No rentals are waiting for review.</h3>
                <p>New landlord submissions will appear here.</p>
              </div>
            ) : (
              <ul className="moderation-list">
                {listings.map((listing) => (
                  <ModerationCard
                    key={listing.id}
                    listing={listing}
                    note={notes[listing.id] ?? ""}
                    workingAction={
                      workingAction?.listingId === listing.id
                        ? workingAction.action
                        : null
                    }
                    disabled={workingAction !== null}
                    onNoteChange={(value) =>
                      setNotes((current) => ({
                        ...current,
                        [listing.id]: value,
                      }))
                    }
                    onApprove={() => void approve(listing)}
                    onReject={() => void reject(listing)}
                  />
                ))}
              </ul>
            )}
            {meta && meta.totalPages > 1 ? (
              <nav
                className="moderation-pagination"
                aria-label="Moderation queue pages"
              >
                <button
                  type="button"
                  disabled={queuePage <= 1 || workingAction !== null}
                  onClick={() => setQueuePage((current) => current - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  type="button"
                  disabled={
                    queuePage >= meta.totalPages || workingAction !== null
                  }
                  onClick={() => setQueuePage((current) => current + 1)}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}

function ModerationCard({
  listing,
  note,
  workingAction,
  disabled,
  onNoteChange,
  onApprove,
  onReject,
}: {
  listing: AdminPendingListingDto;
  note: string;
  workingAction: ModerationAction | null;
  disabled: boolean;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const title = listing.titleEn ?? listing.titleKm ?? listing.property.name;
  const readyPhotos = listing.images.filter(
    (image) => image.status === "READY",
  );
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${listing.property.latitude},${listing.property.longitude}`,
  )}`;

  return (
    <li className="moderation-card">
      <div className="moderation-card-main">
        <div className="moderation-card-title">
          <div>
            <p>{listing.propertyType.replaceAll("_", " ")}</p>
            <h3 lang={listing.titleEn ? "en" : "km"}>{title}</h3>
          </div>
          <span>{listing.status.replaceAll("_", " ")}</span>
        </div>

        <dl className="moderation-facts">
          <div>
            <dt>Monthly rent</dt>
            <dd>{formatPrice(listing.monthlyPrice, listing.currency)}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>
              {listing.availableUnits} of {listing.property.totalUnits} rooms
            </dd>
          </div>
          <div>
            <dt>Landlord</dt>
            <dd>{listing.landlord.displayName}</dd>
          </div>
          <div>
            <dt>Verification</dt>
            <dd>{listing.landlord.verificationStatus.toLowerCase()}</dd>
          </div>
        </dl>

        <div className="moderation-copy-review">
          <div>
            <h4>Location</h4>
            <p>
              {listing.property.addressLine}, {listing.property.city}
            </p>
            <a href={mapUrl} target="_blank" rel="noreferrer">
              Check pin at {listing.property.latitude.toFixed(6)},{" "}
              {listing.property.longitude.toFixed(6)}
            </a>
          </div>
          <div>
            <h4>Description</h4>
            {listing.descriptionKm ? (
              <p lang="km">{listing.descriptionKm}</p>
            ) : null}
            {listing.descriptionEn ? <p>{listing.descriptionEn}</p> : null}
            {!listing.descriptionKm && !listing.descriptionEn ? (
              <p className="moderation-missing">No description supplied.</p>
            ) : null}
          </div>
        </div>

        <div className="moderation-photos">
          <h4>Photos ({readyPhotos.length} ready)</h4>
          {readyPhotos.length > 0 ? (
            <ul>
              {readyPhotos.map((image) => (
                <li key={image.id}>
                  <Image
                    src={image.publicUrl}
                    alt={image.altTextEn ?? image.altTextKm ?? title}
                    fill
                    sizes="(max-width: 640px) 44vw, 180px"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="moderation-missing">No ready photo supplied.</p>
          )}
        </div>
      </div>

      <div className="moderation-decision">
        <label htmlFor={`moderation-note-${listing.id}`}>
          Correction note for rejection
        </label>
        <textarea
          id={`moderation-note-${listing.id}`}
          value={note}
          minLength={3}
          maxLength={2_000}
          rows={4}
          placeholder="Explain exactly what the landlord should correct."
          disabled={disabled}
          onChange={(event) => onNoteChange(event.target.value)}
        />
        <div>
          <button
            className="moderation-reject"
            type="button"
            disabled={disabled}
            onClick={onReject}
          >
            {workingAction === "reject" ? "Rejecting…" : "Reject with note"}
          </button>
          <button
            className="moderation-approve"
            type="button"
            disabled={disabled}
            onClick={onApprove}
          >
            {workingAction === "approve"
              ? "Publishing…"
              : "Approve and publish"}
          </button>
        </div>
      </div>
    </li>
  );
}

function formatPrice(amount: number, currency: "USD" | "KHR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KHR" ? 0 : 2,
  }).format(amount);
}
