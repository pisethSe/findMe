"use client";

import type { FavoritesPage } from "@findme/contracts";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AuthApiError,
  getOnboardingState,
  isAuthenticationSessionError,
  refreshSession,
} from "../auth/auth-api";
import { listFavorites, setFavorite } from "./favorites-api";

type Status =
  "loading" | "ready" | "guest" | "onboarding" | "forbidden" | "error";
interface FavoritesState {
  status: Status;
  result: FavoritesPage | null;
  pending: ReadonlySet<string>;
  errors: Readonly<Record<string, string>>;
  notice: string;
  retry: () => void;
  toggle: (id: string, saved: boolean) => Promise<void>;
  page: number;
  changePage: (page: number) => void;
}
const Context = createContext<FavoritesState | null>(null);

export function FavoritesProvider({
  listingIds,
  children,
}: {
  listingIds?: readonly string[];
  children: ReactNode;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<FavoritesPage | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [resolvedScope, setResolvedScope] = useState<string | null>(null);
  const generation = useRef(0);
  const mutations = useRef(new Set<string>());
  const idsKey = listingIds ? [...new Set(listingIds)].sort().join(",") : null;
  const scope = `${idsKey ?? "all"}:${page}`;
  const visibleStatus = resolvedScope === scope ? status : "loading";

  const reload = useCallback(
    async (checkSession = true) => {
      const current = ++generation.current;
      setStatus("loading");
      setResolvedScope(scope);
      setResult(null);
      setErrors({});
      try {
        // Reconcile with the HttpOnly cookie when entering/returning to this
        // surface, including an account change in another browser tab.
        if (checkSession) await refreshSession();
        const account = await getOnboardingState();
        if (current !== generation.current) return;
        if (account.role && account.role !== "STUDENT") {
          setStatus("forbidden");
          return;
        }
        if (account.stage !== "COMPLETE") {
          setStatus("onboarding");
          return;
        }
        const response =
          idsKey === ""
            ? {
                data: [],
                meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
              }
            : await listFavorites(
                page,
                idsKey === null ? undefined : idsKey.split(","),
              );
        if (current !== generation.current) return;
        if (page > Math.max(1, response.meta.totalPages)) {
          setPage(Math.max(1, response.meta.totalPages));
          return;
        }
        setResult(response);
        setStatus("ready");
      } catch (error) {
        if (current !== generation.current) return;
        setStatus(
          isAuthenticationSessionError(error)
            ? "guest"
            : error instanceof AuthApiError && error.code === "ROLE_FORBIDDEN"
              ? "forbidden"
              : "error",
        );
      }
    },
    [idsKey, page, scope],
  );

  useEffect(() => {
    void reload();
    const refreshVisible = () => {
      if (
        document.visibilityState === "visible" &&
        mutations.current.size === 0
      )
        void reload();
    };
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("focus", refreshVisible);
    return () => {
      generation.current += 1;
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("focus", refreshVisible);
    };
  }, [reload]);

  async function toggle(id: string, saved: boolean) {
    if (visibleStatus !== "ready" || mutations.current.size > 0) return;
    mutations.current.add(id);
    setPending(new Set(mutations.current));
    setErrors((current) => ({ ...current, [id]: "" }));
    setNotice("");
    const current = generation.current;
    try {
      await setFavorite(id, saved);
      if (generation.current !== current) return;
      setNotice(saved ? "Rental saved." : "Rental removed from saved rentals.");
      await reload(false);
      if (idsKey === null) document.getElementById("favorites-title")?.focus();
    } catch (error) {
      if (generation.current !== current) return;
      if (isAuthenticationSessionError(error)) {
        setResult(null);
        setStatus("guest");
      } else if (
        error instanceof AuthApiError &&
        ["ROLE_FORBIDDEN", "STUDENT_ONBOARDING_REQUIRED"].includes(error.code)
      ) {
        setResult(null);
        void reload();
      } else
        setErrors((previous) => ({
          ...previous,
          [id]:
            error instanceof AuthApiError && error.code === "LISTING_NOT_FOUND"
              ? "This rental is no longer available to save. Browse current rentals."
              : "Could not update this saved rental. Check your connection and try again.",
        }));
    } finally {
      mutations.current.delete(id);
      setPending(new Set(mutations.current));
    }
  }

  return (
    <Context.Provider
      value={{
        status: visibleStatus,
        result: resolvedScope === scope ? result : null,
        pending,
        errors,
        notice,
        retry: () => void reload(),
        toggle,
        page,
        changePage: (nextPage) => {
          setPage(nextPage);
          document.getElementById("favorites-title")?.focus();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useFavorites() {
  const value = useContext(Context);
  if (!value) throw new Error("FavoritesProvider is required.");
  return value;
}

export function FavoritesFeedback() {
  const favorites = useFavorites();
  return (
    <>
      <p className="favorite-notice" role="status">
        {favorites.notice}
      </p>
      {favorites.status === "error" ? (
        <p className="favorite-error" role="alert">
          Saved rentals could not be loaded.{" "}
          <button type="button" onClick={favorites.retry}>
            Retry saved rentals
          </button>
        </p>
      ) : null}
    </>
  );
}

export function SaveRentalButton({
  listingId,
  title,
  returnTo,
}: {
  listingId: string;
  title: string;
  returnTo: string;
}) {
  const { status, result, pending, errors, toggle } = useFavorites();
  const saved = result?.data.some((f) => f.listingId === listingId) ?? false;
  if (status === "guest")
    return (
      <Link
        className="favorite-action"
        href={`/login?${new URLSearchParams({ next: returnTo })}`}
      >
        Sign in to save<span className="sr-only"> {title}</span>
      </Link>
    );
  if (status === "onboarding")
    return (
      <Link
        className="favorite-action"
        href={`/onboarding/role?${new URLSearchParams({ next: returnTo })}`}
      >
        Complete student profile to save
      </Link>
    );
  return (
    <div className="favorite-control">
      <button
        className="favorite-action"
        type="button"
        aria-pressed={saved}
        aria-label={`${saved ? "Remove saved rental" : "Save rental"}: ${title}`}
        disabled={status !== "ready" || pending.size > 0}
        onClick={() => void toggle(listingId, !saved)}
      >
        {pending.has(listingId)
          ? "Updating…"
          : status === "loading"
            ? "Checking saved…"
            : status === "forbidden"
              ? "Student accounts can save"
              : saved
                ? "Saved · Remove"
                : "Save rental"}
      </button>
      {errors[listingId] ? (
        <p className="favorite-error" role="alert">
          {errors[listingId]}
        </p>
      ) : null}
    </div>
  );
}

export function RentalFavorite({
  listingId,
  title,
  slug,
}: {
  listingId: string;
  title: string;
  slug: string;
}) {
  return (
    <FavoritesProvider listingIds={[listingId]}>
      <SaveRentalButton
        listingId={listingId}
        title={title}
        returnTo={`/rentals/${encodeURIComponent(slug)}`}
      />
      <FavoritesFeedback />
    </FavoritesProvider>
  );
}
