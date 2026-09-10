"use client";
import type {
  AdminPendingListingDto,
  AdminReportDto,
  AdminUserDto,
  OffsetPageMeta,
} from "@findme/contracts";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AuthApiError,
  getOnboardingState,
  isAuthenticationSessionError,
} from "../auth/auth-api";
import { BrandMark } from "../landing/brand-mark";
import { AdminNavigation } from "./admin-navigation";
import { ModerationCard } from "./admin-workspace";
import {
  adminAction,
  listAdmin,
  type AdminRow,
  type AdminSection,
} from "./admin-safety-api";
import styles from "./admin-safety.module.css";
const titles = {
  reports: "Review reported rentals",
  users: "Manage user access",
  listings: "Review rental inventory",
};
export function AdminSafetyWorkspace({
  section,
  listingId,
  initialSearch = "",
}: {
  section: AdminSection;
  listingId?: string | undefined;
  initialSearch?: string | undefined;
}) {
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState(section === "reports" ? "OPEN" : "");
  const [query, setQuery] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<
    "loading" | "admin" | "denied" | "guest"
  >("loading");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      setRows(null);
      setError(null);
      try {
        const state = await getOnboardingState();
        if (!active) return;
        if (state.role !== "ADMIN") {
          setAccess("denied");
          return;
        }
        setAccess("admin");
        const result = await listAdmin(
          section,
          page,
          filter,
          search,
          listingId,
        );
        if (!active) return;
        if (page > Math.max(1, result.meta.totalPages)) {
          setPage(Math.max(1, result.meta.totalPages));
          return;
        }
        setRows(result.data);
        setMeta(result.meta);
      } catch (caught) {
        if (!active) return;
        if (isAuthenticationSessionError(caught)) setAccess("guest");
        else if (
          caught instanceof AuthApiError &&
          caught.code === "ROLE_FORBIDDEN"
        )
          setAccess("denied");
        else setError("The admin records could not be loaded. Try again.");
      }
    }
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible" && !busy.current) void load();
    };
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
    };
  }, [section, page, filter, search, attempt, listingId]);
  async function act(row: AdminRow, action: string, note: string) {
    if (busy.current) return;
    busy.current = true;
    setWorking(true);
    setNotice("");
    try {
      await adminAction(
        section,
        row.id,
        action,
        note,
        "status" in row ? row.status : row.accountStatus,
      );
      setNotice("Action saved and recorded in the audit log.");
      setAttempt((n) => n + 1);
      heading.current?.focus();
    } catch (caught) {
      if (
        isAuthenticationSessionError(caught) ||
        (caught instanceof AuthApiError && caught.code === "ROLE_FORBIDDEN")
      ) {
        setRows(null);
        setAccess("guest");
      } else throw caught;
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }
  return (
    <main className="workspace-page" lang="en">
      <header className="workspace-header">
        <BrandMark />
        <Link href="/search">Browse student rentals</Link>
      </header>
      <section className={`workspace-content ${styles.scope}`}>
        <AdminNavigation />
        <h1 ref={heading} tabIndex={-1}>
          {titles[section]}
        </h1>
        <p>
          {section === "reports"
            ? "Review the rental and report, then record a decision. Resolving a report does not remove the rental; use rental moderation for that."
            : section === "users"
              ? "Suspension revokes sessions and pauses published rentals. Reactivation restores access without republishing rentals or extending trials."
              : "Inspect rental content and remove inaccurate or prohibited supply. Publishing remains in the pending-rental queue."}
        </p>
        <p role="status">{notice}</p>
        {access === "guest" ? (
          <p>
            <Link href="/login">Sign in with an administrator account</Link>
          </p>
        ) : access === "denied" ? (
          <p role="alert">Administrator access is required.</p>
        ) : (
          <>
            <form
              className={styles.toolbar}
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setSearch(query);
              }}
            >
              {section !== "users" && !listingId ? (
                <label>
                  Status
                  <select
                    value={filter}
                    disabled={working}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    {(section === "reports"
                      ? ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]
                      : [
                          "",
                          "DRAFT",
                          "PENDING_REVIEW",
                          "PUBLISHED",
                          "PAUSED",
                          "RENTED",
                          "REJECTED",
                          "ARCHIVED",
                        ]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {s ? s.replaceAll("_", " ") : "All statuses"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {section !== "reports" && !listingId ? (
                <>
                  <label>
                    {section === "users" ? "Name or user ID" : "Rental title"}
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      maxLength={100}
                      disabled={working}
                    />
                  </label>
                  <button disabled={working}>Search</button>
                </>
              ) : null}
            </form>
            {error ? (
              <div role="alert">
                <p>{error}</p>
                <button onClick={() => setAttempt((n) => n + 1)}>
                  Retry loading
                </button>
              </div>
            ) : !rows ? (
              <p role="status">Loading protected records…</p>
            ) : rows.length === 0 ? (
              <p>
                No records match this view. Change the filter or search to
                review other records.
              </p>
            ) : (
              <ul className={styles.list}>
                {rows.map((row) => (
                  <li key={row.id} className={styles.row}>
                    {section === "reports" ? (
                      <ReportSummary row={row as AdminReportDto} />
                    ) : section === "users" ? (
                      <UserSummary row={row as AdminUserDto} />
                    ) : (
                      <ul className={styles.list}>
                        <ModerationCard
                          listing={row as AdminPendingListingDto}
                          note=""
                          workingAction={null}
                          disabled={working}
                          onNoteChange={() => {}}
                          onApprove={() => {}}
                          onReject={() => {}}
                          reviewOnly
                        />
                      </ul>
                    )}
                    <Decision
                      key={`${row.id}-${"status" in row ? row.status : row.accountStatus}`}
                      row={row}
                      section={section}
                      disabled={working}
                      onAction={act}
                    />
                  </li>
                ))}
              </ul>
            )}
            {meta && rows ? (
              <nav className={styles.toolbar} aria-label="Admin record pages">
                <button
                  disabled={page <= 1 || working}
                  onClick={() => setPage((n) => n - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {Math.max(1, meta.totalPages)} · {meta.total}{" "}
                  records
                </span>
                <button
                  disabled={page >= meta.totalPages || working}
                  onClick={() => setPage((n) => n + 1)}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
function ReportSummary({ row }: { row: AdminReportDto }) {
  return (
    <>
      <h2>{row.reason.replaceAll("_", " ")}</h2>
      <p>
        {row.status.replaceAll("_", " ")} ·{" "}
        {new Date(row.createdAt).toLocaleString("en-GB")}
      </p>
      <p className={styles.copy}>
        {row.details || "No additional details supplied."}
      </p>
      <p>
        <Link href={`/admin/listings?id=${row.listing.id}`}>
          Review rental:{" "}
          {row.listing.titleEn ?? row.listing.titleKm ?? row.listing.slug}
        </Link>
      </p>
      <p>
        <Link href={`/admin/users?query=${row.listing.landlordId}`}>
          Review landlord account
        </Link>
      </p>
      {row.resolutionNote ? (
        <p className={styles.copy}>Review note: {row.resolutionNote}</p>
      ) : null}
    </>
  );
}
function UserSummary({ row }: { row: AdminUserDto }) {
  return (
    <>
      <h2>{row.displayName}</h2>
      <p>
        {row.role ?? "Role not selected"} · {row.accountStatus}
      </p>
      <p>User ID: {row.id}</p>
      {row.role === "ADMIN" ? (
        <p>Administrator accounts are protected from these actions.</p>
      ) : null}
    </>
  );
}
function Decision({
  row,
  section,
  disabled,
  onAction,
}: {
  row: AdminRow;
  section: AdminSection;
  disabled: boolean;
  onAction: (row: AdminRow, action: string, note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const status = "status" in row ? row.status : row.accountStatus;
  const actions: [string, string][] = [];
  if (section === "reports" && ["OPEN", "IN_REVIEW"].includes(status)) {
    if (status === "OPEN") actions.push(["IN_REVIEW", "Start review"]);
    actions.push(
      ["RESOLVED", "Resolve report"],
      ["DISMISSED", "Dismiss report"],
    );
  } else if (section === "users" && (row as AdminUserDto).role !== "ADMIN") {
    actions.push(
      status === "SUSPENDED"
        ? ["reactivate", "Reactivate account"]
        : ["suspend", "Suspend account"],
    );
  } else if (section === "listings" && status !== "ARCHIVED") {
    if (status === "PUBLISHED") actions.push(["pause", "Pause rental"]);
    actions.push(["archive", "Archive rental"]);
  }
  if (!actions.length) return null;
  async function decide(action: string) {
    if (disabled || pending) return;
    if (note.trim().length < 3) {
      setError(
        "Enter a note of at least 3 characters explaining this decision.",
      );
      field.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onAction(row, action, note.trim());
    } catch {
      setError(
        "The action could not be confirmed. Your note is still here. Refresh and review the current state before retrying.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className={styles.decision}>
      <label htmlFor={`note-${row.id}`}>Decision note (required)</label>
      <textarea
        ref={field}
        id={`note-${row.id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={2000}
        rows={3}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `error-${row.id}` : undefined}
      />
      {error ? (
        <p id={`error-${row.id}`} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.toolbar}>
        {actions.map(([action, label]) => (
          <button
            key={action}
            disabled={disabled}
            onClick={() => void decide(action)}
          >
            {pending ? "Saving…" : label}
          </button>
        ))}
      </div>
    </div>
  );
}
