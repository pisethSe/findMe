"use client";
import type {
  AdminAmenityDto,
  AdminInstitutionDto,
  OffsetPageMeta,
} from "@findme/contracts";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  authorizedPageRequest,
  authorizedRequest,
  getOnboardingState,
  isAuthenticationSessionError,
} from "../auth/auth-api";
import { AdminNavigation } from "./admin-navigation";
import { BrandMark } from "../landing/brand-mark";
import styles from "./admin-safety.module.css";
type Row = AdminAmenityDto | AdminInstitutionDto;
type Kind = "institutions" | "amenities";
function validRow(value: unknown, kind: Kind): value is Row {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.nameKm === "string" &&
    typeof r.nameEn === "string" &&
    typeof r.isActive === "boolean" &&
    (kind === "institutions"
      ? typeof r.slug === "string" &&
        typeof r.latitude === "number" &&
        typeof r.longitude === "number" &&
        typeof r.city === "string" &&
        (r.addressEn === null || typeof r.addressEn === "string") &&
        ["UNIVERSITY", "COLLEGE", "SCHOOL", "OTHER"].includes(String(r.type))
      : typeof r.key === "string" &&
        typeof r.sortOrder === "number" &&
        (r.category === null || typeof r.category === "string"))
  );
}
export function AdminCatalog({ kind }: { kind: Kind }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<OffsetPageMeta | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    setRows(null);
    setError("");
    void (async () => {
      try {
        const state = await getOnboardingState();
        if (!active) return;
        if (state.role !== "ADMIN") {
          setDenied(true);
          return;
        }
        const result = await authorizedPageRequest<unknown, OffsetPageMeta>(
          `/admin/${kind}?page=${page}&pageSize=20`,
          { method: "GET" },
        );
        if (!active) return;
        if (
          !Array.isArray(result.data) ||
          !result.data.every((r) => validRow(r, kind)) ||
          !Number.isInteger(result.meta?.totalPages) ||
          result.meta.totalPages < 0
        )
          throw new Error("Invalid catalog response");
        setRows(result.data);
        setMeta(result.meta);
      } catch (caught) {
        if (active) {
          if (isAuthenticationSessionError(caught)) {
            setDenied(true);
            setEditing(null);
          } else setError("Catalog could not be loaded. Try again.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [kind, page, attempt]);
  return (
    <main className="workspace-page" lang="en">
      <header className="workspace-header">
        <BrandMark />
        <Link href="/search">Browse student rentals</Link>
      </header>
      <section className={`workspace-content ${styles.scope}`}>
        <AdminNavigation />
        <h1 ref={heading} tabIndex={-1}>
          Manage {kind}
        </h1>
        <p>
          Maintain Khmer and English names. Deactivation hides a record from new
          selections and preserves existing data.
        </p>
        <p role="status">{notice}</p>
        {denied ? (
          <p role="alert">
            Administrator access is required. <Link href="/login">Sign in</Link>
          </p>
        ) : (
          <>
            {error ? (
              <div role="alert">
                <p>{error}</p>
                <button onClick={() => setAttempt((n) => n + 1)}>
                  Retry loading
                </button>
              </div>
            ) : !rows ? (
              <p role="status">Loading catalog…</p>
            ) : (
              <>
                <button onClick={() => setEditing("new")}>
                  Add {kind === "institutions" ? "institution" : "amenity"}
                </button>
                {editing ? (
                  <CatalogEditor
                    key={typeof editing === "string" ? "new" : editing.id}
                    kind={kind}
                    row={editing === "new" ? null : editing}
                    onCancel={() => setEditing(null)}
                    onSaved={() => {
                      setEditing(null);
                      setAttempt((n) => n + 1);
                      setNotice("Catalog saved and audit record created.");
                      heading.current?.focus();
                    }}
                    onDenied={() => {
                      setEditing(null);
                      setRows(null);
                      setDenied(true);
                    }}
                  />
                ) : null}
                {rows.length === 0 ? (
                  <p>No catalog records yet. Add the first record above.</p>
                ) : (
                  <ul className={styles.list}>
                    {rows.map((row) => (
                      <li key={row.id} className={styles.row}>
                        <h2>{row.nameEn}</h2>
                        <p lang="km">{row.nameKm}</p>
                        <p>{row.isActive ? "Active" : "Inactive"}</p>
                        <button onClick={() => setEditing(row)}>
                          Edit {row.nameEn}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <nav className={styles.toolbar} aria-label="Catalog pages">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((n) => n - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {Math.max(1, meta?.totalPages ?? 1)}
                  </span>
                  <button
                    disabled={page >= (meta?.totalPages ?? 1)}
                    onClick={() => setPage((n) => n + 1)}
                  >
                    Next
                  </button>
                </nav>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
function CatalogEditor({
  kind,
  row,
  onCancel,
  onSaved,
  onDenied,
}: {
  kind: Kind;
  row: Row | null;
  onCancel: () => void;
  onSaved: () => void;
  onDenied: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const base = {
      nameEn: String(data.get("nameEn")),
      nameKm: String(data.get("nameKm")),
      isActive: data.get("isActive") === "on",
    };
    const body =
      kind === "institutions"
        ? {
            ...base,
            slug: String(data.get("slug")),
            type: String(data.get("type")),
            addressEn: String(data.get("addressEn")),
            city: String(data.get("city")),
            latitude: Number(data.get("latitude")),
            longitude: Number(data.get("longitude")),
          }
        : {
            ...base,
            key: String(data.get("key")),
            category: String(data.get("category")),
            sortOrder: Number(data.get("sortOrder")),
          };
    try {
      const result = await authorizedRequest<unknown>(
        `/admin/${kind}${row ? `/${row.id}` : ""}`,
        { method: row ? "PATCH" : "POST", body },
      );
      if (!validRow(result, kind)) throw new Error("Invalid response");
      onSaved();
    } catch (caught) {
      if (isAuthenticationSessionError(caught)) onDenied();
      else
        setError(
          "The record could not be saved. Check required fields and whether the slug or key is already used. Your edits are still here.",
        );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const institution = row && "slug" in row ? row : null;
  const amenity = row && "key" in row ? row : null;
  return (
    <form className={styles.decision} onSubmit={submit} aria-busy={pending}>
      <h2>
        {row ? "Edit" : "Add"}{" "}
        {kind === "institutions" ? "institution" : "amenity"}
      </h2>
      <fieldset disabled={pending} className={styles.fields}>
        <label>
          English name
          <input
            ref={first}
            name="nameEn"
            required
            maxLength={120}
            defaultValue={row?.nameEn ?? ""}
          />
        </label>
        <label>
          Khmer name
          <input
            name="nameKm"
            lang="km"
            required
            maxLength={120}
            defaultValue={row?.nameKm ?? ""}
          />
        </label>
        {kind === "institutions" ? (
          <>
            <label>
              URL slug
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={160}
                defaultValue={institution?.slug ?? ""}
              />
            </label>
            <label>
              Institution type
              <select
                name="type"
                defaultValue={institution?.type ?? "UNIVERSITY"}
              >
                {["UNIVERSITY", "COLLEGE", "SCHOOL", "OTHER"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Address
              <input
                name="addressEn"
                required
                maxLength={500}
                defaultValue={institution?.addressEn ?? ""}
              />
            </label>
            <label>
              City
              <input
                name="city"
                required
                maxLength={120}
                defaultValue={institution?.city ?? "Phnom Penh"}
              />
            </label>
            <label>
              Latitude
              <input
                name="latitude"
                type="number"
                step="0.000001"
                min={-90}
                max={90}
                required
                defaultValue={institution?.latitude ?? ""}
              />
            </label>
            <label>
              Longitude
              <input
                name="longitude"
                type="number"
                step="0.000001"
                min={-180}
                max={180}
                required
                defaultValue={institution?.longitude ?? ""}
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Stable key
              <input
                name="key"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={80}
                defaultValue={amenity?.key ?? ""}
              />
            </label>
            <label>
              Category
              <input
                name="category"
                maxLength={80}
                defaultValue={amenity?.category ?? ""}
              />
            </label>
            <label>
              Sort order
              <input
                name="sortOrder"
                type="number"
                min={0}
                max={10000}
                required
                defaultValue={amenity?.sortOrder ?? 0}
              />
            </label>
          </>
        )}
        <label>
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={row?.isActive ?? true}
          />{" "}
          Active
        </label>
      </fieldset>
      {error ? <p role="alert">{error}</p> : null}
      <div className={styles.toolbar}>
        <button disabled={pending}>
          {pending ? "Saving…" : "Save catalog record"}
        </button>
        <button type="button" disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
