"use client";

import type { ReportReason } from "@findme/contracts";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { AuthApiError, isAuthenticationSessionError } from "../auth/auth-api";
import { createReport } from "./reports-api";
import styles from "./report-form.module.css";

const reasons: { value: ReportReason; label: string }[] = [
  { value: "INACCURATE", label: "Incorrect rental details" },
  { value: "UNAVAILABLE", label: "No longer available" },
  { value: "SCAM_SUSPICIOUS", label: "Suspicious or possible scam" },
  { value: "DUPLICATE", label: "Duplicate listing" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "OTHER", label: "Other issue" },
];

export function ReportForm({
  listingId,
  slug,
}: {
  listingId: string;
  slug: string;
}) {
  const [reason, setReason] = useState<ReportReason>("INACCURATE");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [guest, setGuest] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || sent || unavailable) return;
    sending.current = true;
    setPending(true);
    setError(null);
    setGuest(false);
    try {
      await createReport(listingId, { reason, details: details.trim() });
      setSent(true);
      setDetails("");
    } catch (caught) {
      if (isAuthenticationSessionError(caught)) setGuest(true);
      else if (
        caught instanceof AuthApiError &&
        caught.code === "LISTING_NOT_FOUND"
      ) {
        setUnavailable(true);
        setError(
          "This rental is no longer public. A new report cannot be submitted.",
        );
      } else if (
        caught instanceof AuthApiError &&
        caught.code === "REPORT_RATE_LIMITED"
      )
        setError(
          "You’ve reached the report limit. Try again in an hour. Your details are still here.",
        );
      else
        setError(
          "We couldn’t confirm receipt of your report. Your details are still here; you can safely try again.",
        );
    } finally {
      sending.current = false;
      setPending(false);
    }
  }
  const returnQuery = new URLSearchParams({
    next: `/rentals/${encodeURIComponent(slug)}`,
  });
  return (
    <details className={styles.section}>
      <summary>Report this rental</summary>
      <p>
        Tell us about inaccurate or suspicious information. Reports are private
        and are not shared with the landlord. Sign-in is required.
      </p>
      {sent ? (
        <p role="status">
          Your report has been received for review. If you already had an open
          report for this rental, we kept that report.
        </p>
      ) : (
        <form onSubmit={submit} aria-busy={pending}>
          <label htmlFor="report-reason">Reason</label>
          <select
            id="report-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value as ReportReason)}
            disabled={pending || unavailable}
          >
            {reasons.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <label htmlFor="report-details">Details (optional)</label>
          <textarea
            id="report-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={4}
            maxLength={2000}
            disabled={pending || unavailable}
            aria-describedby="report-help"
          />
          <p id="report-help" className={styles.help}>
            Describe what is wrong, up to 2,000 characters. Do not include
            passwords, payment details, or other sensitive information.
          </p>
          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
          {guest ? (
            <p role="alert">
              <Link href={`/login?${returnQuery}`}>
                Sign in to report this rental
              </Link>
            </p>
          ) : null}
          <button
            className={styles.submit}
            disabled={pending || unavailable}
            type="submit"
          >
            {pending
              ? "Submitting report…"
              : unavailable
                ? "Rental unavailable"
                : "Submit report"}
          </button>
        </form>
      )}
    </details>
  );
}
