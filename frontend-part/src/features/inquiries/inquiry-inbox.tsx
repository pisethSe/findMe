"use client";

import type {
  LandlordInquiryDto,
  OffsetPageMeta,
  StudentInquiryDto,
} from "@findme/contracts";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AuthApiError,
  getOnboardingState,
  isAuthenticationSessionError,
  refreshSession,
} from "../auth/auth-api";
import { BrandMark } from "../landing/brand-mark";
import { rentalDate } from "../rentals/rental-detail-model";
import {
  listLandlordInquiries,
  listStudentInquiries,
  updateInquiryStatus,
} from "./inquiries-api";
import {
  allowedInquiryStatuses,
  inquiryStatusLabel,
  type EditableInquiryStatus,
} from "./inquiry-model";
import styles from "./inquiry-inbox.module.css";

type Inquiry = StudentInquiryDto | LandlordInquiryDto;
type Access =
  "loading" | "ready" | "guest" | "onboarding" | "forbidden" | "error";
const actionLabels: Record<EditableInquiryStatus, string> = {
  READ: "Mark as read",
  RESPONDED: "Mark as replied",
  CLOSED: "Close inquiry",
};

export function InquiryInbox({ role }: { role: "STUDENT" | "LANDLORD" }) {
  const [access, setAccess] = useState<Access>("loading");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    data: readonly Inquiry[];
    meta: OffsetPageMeta;
  } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [onboardingPath, setOnboardingPath] = useState("/onboarding/role");
  const generation = useRef(0);
  const updating = useRef(false);
  const title = role === "STUDENT" ? "Sent inquiries" : "Student inquiries";

  const load = useCallback(async () => {
    const current = ++generation.current;
    setAccess("loading");
    setResult(null);
    setErrors({});
    setNotice("");
    try {
      await refreshSession();
      const state = await getOnboardingState();
      if (current !== generation.current) return;
      if (state.role && state.role !== role) {
        setAccess("forbidden");
        return;
      }
      if (state.stage !== "COMPLETE") {
        setOnboardingPath(state.nextPath);
        setAccess("onboarding");
        return;
      }
      const response =
        role === "STUDENT"
          ? await listStudentInquiries(page)
          : await listLandlordInquiries(page);
      if (current !== generation.current) return;
      if (page > Math.max(1, response.meta.totalPages)) {
        setPage(Math.max(1, response.meta.totalPages));
        return;
      }
      setResult(response);
      setAccess("ready");
    } catch (caught) {
      if (current !== generation.current) return;
      setAccess(
        isAuthenticationSessionError(caught)
          ? "guest"
          : caught instanceof AuthApiError && caught.code === "ROLE_FORBIDDEN"
            ? "forbidden"
            : "error",
      );
    }
  }, [page, role]);

  useEffect(() => {
    void load();
    const visible = () => {
      if (document.visibilityState === "visible" && !updating.current)
        void load();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    return () => {
      generation.current += 1;
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
    };
  }, [load]);

  async function changeStatus(id: string, status: EditableInquiryStatus) {
    if (updating.current || role !== "LANDLORD" || access !== "ready") return;
    updating.current = true;
    setPending(id);
    setErrors((previous) => ({ ...previous, [id]: "" }));
    setNotice("");
    const current = generation.current;
    try {
      const row = await updateInquiryStatus(id, status);
      if (current !== generation.current) return;
      setResult((previous) =>
        previous
          ? {
              ...previous,
              data: previous.data.map((item) => (item.id === id ? row : item)),
            }
          : null,
      );
      setNotice(`Inquiry status updated: ${inquiryStatusLabel(row.status)}.`);
      document.getElementById(`inquiry-${id}`)?.focus();
    } catch (caught) {
      if (current !== generation.current) return;
      if (isAuthenticationSessionError(caught)) {
        setResult(null);
        setAccess("guest");
      } else if (
        caught instanceof AuthApiError &&
        caught.code === "ROLE_FORBIDDEN"
      ) {
        setResult(null);
        setAccess("forbidden");
      } else
        setErrors((previous) => ({
          ...previous,
          [id]:
            caught instanceof AuthApiError &&
            ["INQUIRY_STATUS_CONFLICT", "INQUIRY_NOT_FOUND"].includes(
              caught.code,
            )
              ? "This inquiry changed or is unavailable. Refresh your inbox before trying again."
              : "The status could not be updated. Try again; the previous status is still shown.",
        }));
    } finally {
      updating.current = false;
      setPending(null);
    }
  }

  function changePage(next: number) {
    setPage(next);
    document.getElementById("inbox-title")?.focus();
  }

  return (
    <main className={styles.page} lang="en">
      <header className="site-header">
        <BrandMark />
        <nav className="rental-navigation" aria-label="Inquiry navigation">
          {role === "STUDENT" ? (
            <>
              <Link href="/favorites">Saved rentals</Link>
              <Link href="/search">Find nearby rentals</Link>
            </>
          ) : (
            <Link href="/landlord">Back to dashboard</Link>
          )}
        </nav>
      </header>
      <section className={styles.shell} aria-labelledby="inbox-title">
        <header className={styles.heading}>
          <h1 id="inbox-title" tabIndex={-1}>
            {title}
          </h1>
          <p>
            {role === "STUDENT"
              ? "Review the messages you sent and the status recorded by each landlord."
              : "Read messages about your rentals. Reply using the contact details a student chose to include, then mark the inquiry as replied."}
          </p>
        </header>
        <p role="status" className={styles.notice}>
          {notice}
        </p>
        {access === "loading" ? (
          <div className={styles.state} role="status">
            Loading inquiries…
          </div>
        ) : access === "guest" ? (
          <div className={styles.state}>
            <h2>Sign in to view your inquiries</h2>
            <p>Inquiry history is private to your account.</p>
            <Link
              href={role === "STUDENT" ? "/login?next=%2Finquiries" : "/login"}
            >
              Sign in
            </Link>
          </div>
        ) : access === "onboarding" ? (
          <div className={styles.state}>
            <h2>Complete your account setup</h2>
            <Link
              href={
                role === "STUDENT"
                  ? `${onboardingPath}?next=%2Finquiries`
                  : onboardingPath
              }
            >
              Continue account setup
            </Link>
          </div>
        ) : access === "forbidden" ? (
          <div className={styles.state}>
            <h2>
              {role === "STUDENT"
                ? "Sent inquiries are for student accounts"
                : "This inbox is for landlord accounts"}
            </h2>
            <Link href="/search">Browse nearby rentals</Link>
          </div>
        ) : access === "error" ? (
          <div className={styles.state} role="alert">
            <h2>Inquiries could not be loaded</h2>
            <p>Check your connection and try again.</p>
            <button type="button" onClick={() => void load()}>
              Retry inquiries
            </button>
          </div>
        ) : result ? (
          <>
            <div className={styles.toolbar}>
              <p>
                {result.meta.total}{" "}
                {result.meta.total === 1 ? "inquiry" : "inquiries"}
              </p>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void load()}
              >
                Refresh inbox
              </button>
            </div>
            {result.data.length === 0 ? (
              <div className={styles.state}>
                <h2>
                  {role === "STUDENT"
                    ? "No sent inquiries yet"
                    : "No student inquiries yet"}
                </h2>
                <p>
                  {role === "STUDENT"
                    ? "Open a rental to ask about availability, costs, or a visit."
                    : "Messages from students will appear here when they inquire about your published rentals."}
                </p>
                <Link href={role === "STUDENT" ? "/search" : "/landlord"}>
                  {role === "STUDENT"
                    ? "Find nearby rentals"
                    : "Manage rentals"}
                </Link>
              </div>
            ) : (
              <ol className={styles.list}>
                {result.data.map((inquiry) => {
                  const listing = inquiry.listing;
                  const rentalTitle =
                    listing?.titleEn ??
                    listing?.titleKm ??
                    (listing && "propertyName" in listing
                      ? listing.propertyName
                      : "Rental no longer available");
                  return (
                    <li
                      id={`inquiry-${inquiry.id}`}
                      key={inquiry.id}
                      tabIndex={-1}
                      className={styles.inquiry}
                    >
                      <div className={styles.meta}>
                        <p>
                          {"student" in inquiry
                            ? inquiry.student.displayName
                            : "Sent"}{" "}
                          ·{" "}
                          <time dateTime={inquiry.createdAt}>
                            {rentalDate(inquiry.createdAt)}
                          </time>
                        </p>
                        <strong>
                          {role === "LANDLORD" && inquiry.status === "NEW"
                            ? "New"
                            : inquiryStatusLabel(inquiry.status)}
                        </strong>
                      </div>
                      <h2
                        lang={
                          listing?.titleEn
                            ? "en"
                            : listing?.titleKm
                              ? "km"
                              : "en"
                        }
                      >
                        {listing && "slug" in listing ? (
                          <Link
                            href={`/rentals/${encodeURIComponent(listing.slug)}`}
                            prefetch={false}
                          >
                            {rentalTitle}
                          </Link>
                        ) : (
                          rentalTitle
                        )}
                      </h2>
                      {!listing ? (
                        <p className={styles.muted}>
                          The rental is no longer publicly available. Your sent
                          message is still shown below.
                        </p>
                      ) : null}
                      <p className={styles.message} dir="auto">
                        {inquiry.message}
                      </p>
                      <p className={styles.updated}>
                        Status updated{" "}
                        <time dateTime={inquiry.updatedAt}>
                          {rentalDate(inquiry.updatedAt)}
                        </time>
                      </p>
                      {role === "LANDLORD" ? (
                        <div
                          className={styles.actions}
                          aria-label="Inquiry status actions"
                        >
                          {allowedInquiryStatuses(inquiry.status).map(
                            (status) => (
                              <button
                                key={status}
                                type="button"
                                disabled={pending !== null}
                                onClick={() =>
                                  void changeStatus(inquiry.id, status)
                                }
                              >
                                {pending === inquiry.id
                                  ? "Updating…"
                                  : actionLabels[status]}
                              </button>
                            ),
                          )}
                        </div>
                      ) : inquiry.status === "RESPONDED" ? (
                        <p className={styles.muted}>
                          The landlord marked this as replied. Check the contact
                          channel you included in your message.
                        </p>
                      ) : null}
                      {errors[inquiry.id] ? (
                        <p role="alert" className={styles.error}>
                          {errors[inquiry.id]}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
            {result.meta.totalPages > 1 ? (
              <nav className="search-pagination" aria-label="Inquiry pages">
                <button
                  type="button"
                  disabled={page <= 1 || pending !== null}
                  onClick={() => changePage(page - 1)}
                >
                  Previous
                </button>
                <p>
                  Page <strong>{page}</strong> of {result.meta.totalPages}
                </p>
                <button
                  type="button"
                  disabled={page >= result.meta.totalPages || pending !== null}
                  onClick={() => changePage(page + 1)}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
