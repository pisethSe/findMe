"use client";

import type {
  InstitutionDto,
  PropertyType,
  PublicListingDto,
  PublicListingSearchPage,
  SearchViewport,
} from "@findme/contracts";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { BrandMark } from "../landing/brand-mark";
import { InstitutionPicker } from "./institution-picker";
import { buildInstitutionSearchHref } from "./institution-search-model";
import { PublishedRentalMap } from "./published-rental-map";
import {
  findInstitutionBySlug,
  searchInstitutions,
  searchPublishedListings,
} from "./search-api";
import {
  shouldRefreshVisibleSearch,
  VISIBLE_SEARCH_REFRESH_MS,
} from "./search-refresh";
import {
  resultScrollBehavior,
  type MobileResultsView,
  visibleResultRange,
  viewAfterResultSelection,
} from "./search-ui-state";
import {
  buildSearchMapHref,
  parseSearchMapState,
  searchViewportsEqual,
} from "./search-url-state";

const RESULT_PAGE_SIZE = 12;

const PROPERTY_TYPE_OPTIONS: ReadonlyArray<{
  value: PropertyType;
  label: string;
}> = [
  { value: "ROOM", label: "Room" },
  { value: "STUDIO", label: "Studio" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "HOUSE", label: "House" },
  { value: "DORM_ROOM", label: "Dorm room" },
  { value: "OTHER_STUDENT_RENTAL", label: "Other student rental" },
];

const PROPERTY_TYPE_LABELS = Object.fromEntries(
  PROPERTY_TYPE_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<PropertyType, string>;

interface PublishedRentalSearchProps {
  institutionSlug: string;
  maxRentUsd: number;
  maxDistanceKm: number;
  propertyType?: PropertyType;
  initialPage: number;
  initialViewport: SearchViewport | null;
  invalidFilters: boolean;
}

export function PublishedRentalSearch({
  institutionSlug,
  maxRentUsd,
  maxDistanceKm,
  propertyType,
  initialPage,
  initialViewport,
  invalidFilters,
}: PublishedRentalSearchProps) {
  const router = useRouter();
  const [institution, setInstitution] = useState<InstitutionDto | null>(null);
  const [institutionLoading, setInstitutionLoading] = useState(true);
  const [institutionEmpty, setInstitutionEmpty] = useState(false);
  const [institutionsError, setInstitutionsError] = useState<string | null>(
    null,
  );
  const [selectionValid, setSelectionValid] = useState(false);
  const [requestedInstitutionMissing, setRequestedInstitutionMissing] =
    useState(false);
  const [page, setPage] = useState<PublicListingSearchPage | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [institutionAttempt, setInstitutionAttempt] = useState(0);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null,
  );
  const [focusListingId, setFocusListingId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileResultsView>("list");
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [viewport, setViewport] = useState<SearchViewport | null>(
    initialViewport,
  );
  const searchAbortRef = useRef<AbortController | null>(null);
  const resolvedInstitutionSlugRef = useRef<string | null>(null);
  const pageRef = useRef<PublicListingSearchPage | null>(null);
  const searchScopeRef = useRef<string | null>(null);
  const serverStateKey = `${institutionSlug}:${maxRentUsd}:${maxDistanceKm}:${propertyType ?? "all"}:${initialPage}:${JSON.stringify(initialViewport)}`;
  const serverStateKeyRef = useRef(serverStateKey);

  useEffect(() => {
    if (serverStateKeyRef.current === serverStateKey) return;
    serverStateKeyRef.current = serverStateKey;
    setCurrentPage(initialPage);
    setViewport(initialViewport);
    setFocusListingId(null);
  }, [initialPage, initialViewport, serverStateKey]);

  useEffect(() => {
    const restoreHistoryState = () => {
      const params = Object.fromEntries(
        new URLSearchParams(window.location.search).entries(),
      );
      const restored = parseSearchMapState(params);
      setCurrentPage(restored.page);
      setViewport(restored.viewport);
      setFocusListingId(null);
    };
    window.addEventListener("popstate", restoreHistoryState);
    return () => window.removeEventListener("popstate", restoreHistoryState);
  }, []);

  useEffect(() => {
    if (resolvedInstitutionSlugRef.current === institutionSlug) return;
    const controller = new AbortController();
    setInstitutionLoading(true);
    setInstitutionEmpty(false);
    setInstitutionsError(null);
    setInstitution(null);
    setSelectionValid(false);
    setPage(null);
    pageRef.current = null;
    searchScopeRef.current = null;
    setSelectedListingId(null);
    setFocusListingId(null);
    setRequestedInstitutionMissing(false);

    async function resolveInstitution() {
      try {
        const requested = await findInstitutionBySlug(
          institutionSlug,
          controller.signal,
        );
        const fallback = requested
          ? null
          : await searchInstitutions({ limit: 1 }, controller.signal);
        if (controller.signal.aborted) return;

        const selected = requested ?? fallback?.data[0] ?? null;
        resolvedInstitutionSlugRef.current = institutionSlug;
        setInstitution(selected);
        setSelectionValid(Boolean(selected));
        setInstitutionEmpty(!selected);
        setRequestedInstitutionMissing(Boolean(!requested && selected));

        const currentParams = new URLSearchParams(window.location.search);
        if (requested && !currentParams.has("institution")) {
          router.replace(
            buildInstitutionSearchHref(window.location.search, requested.slug),
            { scroll: false },
          );
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        setInstitutionsError(
          error instanceof Error
            ? error.message
            : "FindMe could not load institutions.",
        );
      } finally {
        if (!controller.signal.aborted) setInstitutionLoading(false);
      }
    }

    void resolveInstitution();
    return () => controller.abort();
  }, [institutionAttempt, institutionSlug, router]);

  const loadResults = useCallback(
    async (selectedInstitution: InstitutionDto, background: boolean) => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      if (background) setRefreshing(true);
      else {
        setPage(null);
        pageRef.current = null;
        setSearchError(null);
      }
      setRefreshError(null);

      try {
        const result = await searchPublishedListings(
          {
            institutionId: selectedInstitution.id,
            radiusMeters: Math.round(maxDistanceKm * 1_000),
            maxPrice: maxRentUsd,
            currency: "USD",
            ...(propertyType ? { propertyType } : {}),
            ...(viewport ? { viewport } : {}),
            page: currentPage,
            pageSize: RESULT_PAGE_SIZE,
          },
          controller.signal,
        );
        pageRef.current = result;
        setPage(result);
        setSelectedListingId((current) =>
          current && result.data.some((listing) => listing.id === current)
            ? current
            : (result.data[0]?.id ?? null),
        );
        setFocusListingId((current) =>
          current && result.data.some((listing) => listing.id === current)
            ? current
            : null,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error
            ? error.message
            : "FindMe could not load current rentals.";
        if (background) {
          const displayedPage = pageRef.current;
          setRefreshError(message);
          if (
            displayedPage &&
            (displayedPage.meta.page !== currentPage ||
              !searchViewportsEqual(displayedPage.meta.viewport, viewport))
          ) {
            window.history.replaceState(
              null,
              "",
              buildSearchMapHref(window.location.search, {
                page: displayedPage.meta.page,
                viewport: displayedPage.meta.viewport,
              }),
            );
            setCurrentPage(displayedPage.meta.page);
            setViewport(displayedPage.meta.viewport);
          }
        } else setSearchError(message);
      } finally {
        if (!controller.signal.aborted) setRefreshing(false);
      }
    },
    [currentPage, maxDistanceKm, maxRentUsd, propertyType, viewport],
  );

  useEffect(() => {
    if (!institution) return;
    const scope = `${institution.id}:${maxDistanceKm}:${maxRentUsd}:${propertyType ?? "all"}`;
    const foreground =
      searchScopeRef.current !== scope || pageRef.current === null;
    searchScopeRef.current = scope;
    void loadResults(institution, !foreground);

    const refreshWhenVisible = () => {
      if (shouldRefreshVisibleSearch(document.visibilityState)) {
        void loadResults(institution, true);
      }
    };
    const interval = window.setInterval(
      refreshWhenVisible,
      VISIBLE_SEARCH_REFRESH_MS,
    );
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      searchAbortRef.current?.abort();
    };
  }, [institution, loadResults]);

  const selectFromMap = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
    setFocusListingId(null);
    setMobileView(viewAfterResultSelection("marker"));
    window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const card = document.getElementById(`rental-${listingId}`);
      card?.scrollIntoView({
        behavior: resultScrollBehavior(prefersReducedMotion),
        block: "nearest",
      });
      card?.focus({ preventScroll: true });
    });
  }, []);

  const selectFromCard = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
    setFocusListingId(listingId);
    setMobileView(viewAfterResultSelection("card"));
    window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      document.getElementById("rental-map")?.scrollIntoView({
        behavior: resultScrollBehavior(prefersReducedMotion),
        block: "start",
      });
    });
  }, []);

  const updateViewport = useCallback(
    (nextViewport: SearchViewport) => {
      if (searchViewportsEqual(viewport, nextViewport)) return;
      window.history.replaceState(
        null,
        "",
        buildSearchMapHref(window.location.search, {
          page: 1,
          viewport: nextViewport,
        }),
      );
      setCurrentPage(1);
      setViewport(nextViewport);
      setFocusListingId(null);
    },
    [viewport],
  );

  const clearViewport = useCallback(() => {
    window.history.replaceState(
      null,
      "",
      buildSearchMapHref(window.location.search, {
        page: 1,
        viewport: null,
      }),
    );
    setCurrentPage(1);
    setViewport(null);
    setFocusListingId(null);
  }, []);

  const changePage = useCallback(
    (nextPage: number) => {
      if (refreshing || nextPage === currentPage || nextPage < 1) return;
      window.history.pushState(
        null,
        "",
        buildSearchMapHref(window.location.search, {
          page: nextPage,
          viewport,
        }),
      );
      setCurrentPage(nextPage);
      setSelectedListingId(null);
      setFocusListingId(null);
      window.requestAnimationFrame(() => {
        document.getElementById("results-title")?.scrollIntoView({
          behavior: "auto",
          block: "start",
        });
      });
    },
    [currentPage, refreshing, viewport],
  );

  const updateSelectionValidity = useCallback((valid: boolean) => {
    setSelectionValid(valid);
  }, []);

  const selectInstitution = useCallback(
    (selectedInstitution: InstitutionDto) => {
      resolvedInstitutionSlugRef.current = selectedInstitution.slug;
      setInstitution(selectedInstitution);
      setSelectionValid(true);
      setInstitutionEmpty(false);
      setInstitutionsError(null);
      setRequestedInstitutionMissing(false);
      router.replace(
        buildInstitutionSearchHref(
          window.location.search,
          selectedInstitution.slug,
        ),
        { scroll: false },
      );
    },
    [router],
  );

  const submitFilters = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      if (!institution || !selectionValid) event.preventDefault();
    },
    [institution, selectionValid],
  );

  const retryInstitutions = useCallback(() => {
    resolvedInstitutionSlugRef.current = null;
    setInstitutionAttempt((value) => value + 1);
  }, []);

  const warning = invalidFilters || requestedInstitutionMissing;
  const resultRange = page
    ? visibleResultRange(page.meta.page, page.meta.pageSize, page.meta.total)
    : { first: 0, last: 0 };

  useEffect(() => {
    if (!page) return;
    const finalPage = Math.max(page.meta.totalPages, 1);
    if (currentPage <= finalPage) return;
    window.history.replaceState(
      null,
      "",
      buildSearchMapHref(window.location.search, {
        page: finalPage,
        viewport,
      }),
    );
    setCurrentPage(finalPage);
  }, [currentPage, page, viewport]);

  return (
    <main className="search-page" lang="en">
      <header className="site-header search-header">
        <BrandMark />
        <Link href="/">Back to home</Link>
      </header>

      <section className="search-intro">
        <div>
          <h1>Rooms near {institution?.nameEn ?? "your institution"}</h1>
          {institution ? (
            <p className="selected-institution-name" lang="km">
              {institution.nameKm}
            </p>
          ) : null}
          <p>
            Only moderated rentals with current availability appear here. The
            page checks for newly published rooms while you are viewing it.
          </p>
        </div>

        <form
          className="filter-form"
          action="/search"
          method="get"
          onSubmit={submitFilters}
        >
          <InstitutionPicker
            id="search-institution"
            label="Institution"
            selectedInstitution={institution}
            onSelect={selectInstitution}
            onSelectionValidityChange={updateSelectionValidity}
            disabled={
              institutionLoading ||
              institutionEmpty ||
              Boolean(institutionsError)
            }
          />
          <label>
            Maximum rent (USD)
            <input
              name="maxRentUsd"
              type="number"
              min="1"
              max="9999999999"
              step="0.01"
              inputMode="decimal"
              defaultValue={maxRentUsd}
            />
          </label>
          <label>
            Maximum distance (km)
            <input
              name="maxDistanceKm"
              type="number"
              min="0.1"
              max="20"
              step="0.1"
              inputMode="decimal"
              defaultValue={maxDistanceKm}
            />
          </label>
          <label>
            Rental type
            <select name="propertyType" defaultValue={propertyType ?? ""}>
              <option value="">All rental types</option>
              {PROPERTY_TYPE_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!institution || !selectionValid}>
            Update results
          </button>
        </form>
      </section>

      {warning ? (
        <p className="filter-warning" role="alert">
          {requestedInstitutionMissing
            ? "That institution is inactive or unavailable, so the first active institution is shown. Choose another institution or update the results."
            : "One or more shared filters were invalid, so safe defaults are shown. Review the filters and update the results."}
        </p>
      ) : null}

      {institutionsError ? (
        <section className="search-results">
          <div className="workspace-error" role="alert">
            <h2>Institutions unavailable</h2>
            <p>{institutionsError}</p>
            <button type="button" onClick={retryInstitutions}>
              Try again
            </button>
          </div>
        </section>
      ) : institutionEmpty ? (
        <section className="search-results">
          <div className="workspace-error" role="status">
            <h2>No active institutions yet</h2>
            <p>
              Rental discovery will become available when an institution is
              activated. Please check again later.
            </p>
            <button type="button" onClick={retryInstitutions}>
              Check again
            </button>
          </div>
        </section>
      ) : institutionLoading || !institution || (!page && !searchError) ? (
        <SearchLoading />
      ) : searchError ? (
        <section className="search-results">
          <div className="workspace-error" role="alert">
            <h2>Rentals unavailable</h2>
            <p>{searchError}</p>
            <button
              type="button"
              onClick={() => void loadResults(institution, false)}
            >
              Try again
            </button>
          </div>
        </section>
      ) : page ? (
        <section
          className="search-results"
          aria-labelledby="results-title"
          aria-busy={refreshing}
        >
          <div className="results-heading">
            <div>
              <h2 id="results-title">
                {page.meta.total} {page.meta.total === 1 ? "room" : "rooms"}{" "}
                found
              </h2>
              <p>
                {page.meta.total > 0
                  ? `Showing ${resultRange.first}–${resultRange.last} · `
                  : ""}
                {viewport ? "inside this map area" : "within the full radius"}
                {" · "}
                {formatDistance(page.meta.radiusMeters)} from{" "}
                {page.meta.institution.shortName ??
                  page.meta.institution.nameEn}
                {" · checked "}
                <time dateTime={page.meta.refreshedAt}>
                  {formatTime(page.meta.refreshedAt)}
                </time>
              </p>
            </div>
            <div
              className="mobile-result-switch"
              role="group"
              aria-label="Results view"
            >
              <button
                type="button"
                aria-pressed={mobileView === "list"}
                aria-controls="rental-list"
                onClick={() => setMobileView("list")}
              >
                List ({page.data.length})
              </button>
              <button
                type="button"
                aria-pressed={mobileView === "map"}
                aria-controls="rental-map"
                onClick={() => setMobileView("map")}
              >
                Map
              </button>
            </div>
          </div>
          {refreshError ? (
            <p className="search-refresh-warning" role="status">
              Refresh failed. Showing the last complete results. {refreshError}
            </p>
          ) : refreshing ? (
            <p className="search-update-status" role="status">
              {viewport
                ? "Updating rentals in the visible map area…"
                : currentPage > 1
                  ? `Loading results page ${currentPage}…`
                  : "Checking for newly published rentals…"}
            </p>
          ) : null}

          <div
            className="published-search-layout"
            data-mobile-view={mobileView}
          >
            <PublishedRentalMap
              institution={page.meta.institution}
              listings={page.data}
              selectedListingId={selectedListingId}
              focusListingId={focusListingId}
              viewport={viewport}
              active={mobileView === "map"}
              updating={refreshing}
              onSelectListing={selectFromMap}
              onViewportChange={updateViewport}
              onClearViewport={clearViewport}
            />
            <div id="rental-list" className="published-list-region">
              {page.data.length > 0 ? (
                <>
                  <ul className="rental-results published-rental-results">
                    {page.data.map((listing) => (
                      <RentalCard
                        key={listing.id}
                        listing={listing}
                        institution={page.meta.institution}
                        selected={listing.id === selectedListingId}
                        onSelect={() => selectFromCard(listing.id)}
                      />
                    ))}
                  </ul>
                  {page.meta.totalPages > 1 ? (
                    <nav
                      className="search-pagination"
                      aria-label="Rental result pages"
                    >
                      <button
                        type="button"
                        onClick={() => changePage(page.meta.page - 1)}
                        disabled={page.meta.page <= 1 || refreshing}
                      >
                        Previous
                      </button>
                      <p>
                        Page <strong>{page.meta.page}</strong> of{" "}
                        {page.meta.totalPages}
                      </p>
                      <button
                        type="button"
                        onClick={() => changePage(page.meta.page + 1)}
                        disabled={
                          page.meta.page >= page.meta.totalPages || refreshing
                        }
                      >
                        Next
                      </button>
                    </nav>
                  ) : null}
                </>
              ) : (
                <div className="empty-results">
                  <h3>
                    {viewport
                      ? "No rentals are visible in this map area."
                      : "No published rentals match these filters."}
                  </h3>
                  <p>
                    {viewport
                      ? "Show the full search radius, or move back toward the institution and try again."
                      : "Try increasing the distance or monthly budget. Newly approved rentals will appear while this page is open."}
                  </p>
                  <div className="empty-results-actions">
                    {viewport ? (
                      <button type="button" onClick={clearViewport}>
                        Show full radius
                      </button>
                    ) : null}
                    <Link href={`/search?institution=${institution.slug}`}>
                      Reset filters
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function RentalCard({
  listing,
  institution,
  selected,
  onSelect,
}: {
  listing: PublicListingDto;
  institution: InstitutionDto;
  selected: boolean;
  onSelect: () => void;
}) {
  const title = listing.titleEn ?? listing.titleKm ?? "Student rental";
  const location =
    [listing.location.commune, listing.location.district, listing.location.city]
      .filter(Boolean)
      .join(", ") || listing.location.city;
  return (
    <li id={`rental-${listing.id}`} data-selected={selected} tabIndex={-1}>
      {listing.primaryImage ? (
        <div className="rental-card-photo">
          <Image
            src={listing.primaryImage.publicUrl}
            alt={
              listing.primaryImage.altTextEn ??
              listing.primaryImage.altTextKm ??
              title
            }
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 360px"
          />
        </div>
      ) : (
        <div className="photo-unavailable" aria-label="Photo unavailable">
          <span>Photo unavailable</span>
        </div>
      )}
      <div className="rental-card-copy">
        <div className="price-row">
          <strong>
            {formatPrice(listing.monthlyPrice, listing.currency)}/month
          </strong>
          <span className="available-label">
            <span className="availability-check" aria-hidden="true" />
            {listing.availableUnits} available
          </span>
        </div>
        <h3 lang={listing.titleEn ? "en" : "km"}>{title}</h3>
        <p>
          {PROPERTY_TYPE_LABELS[listing.propertyType]} ·{" "}
          {formatDistance(listing.distanceMeters)} from{" "}
          {institution.shortName ?? institution.nameEn}
        </p>
        <p className="location-context">{location}</p>
        {listing.amenities.length > 0 ? (
          <ul className="amenity-list" aria-label="Key amenities">
            {listing.amenities.slice(0, 3).map((amenity) => (
              <li key={amenity.id}>{amenity.nameEn}</li>
            ))}
          </ul>
        ) : null}
        <div className="rental-card-footer">
          <small>
            Last confirmed {formatDate(listing.availabilityConfirmedAt)}
          </small>
          <button
            type="button"
            aria-pressed={selected}
            aria-controls="rental-map"
            onClick={onSelect}
          >
            {selected ? "Shown on map" : "Show on map"}
          </button>
        </div>
      </div>
    </li>
  );
}

function SearchLoading() {
  return (
    <section className="search-results" aria-busy="true" aria-live="polite">
      <p className="search-loading-message">
        Loading current published rentals…
      </p>
      <div className="published-search-layout search-results-loading">
        <div className="skeleton loading-map" aria-hidden="true" />
        <div className="loading-card-grid" aria-hidden="true">
          <div className="skeleton loading-card" />
          <div className="skeleton loading-card" />
          <div className="skeleton loading-card" />
        </div>
      </div>
    </section>
  );
}

function formatPrice(amount: number, currency: "USD" | "KHR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KHR" ? 0 : 2,
  }).format(amount);
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1_000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1_000).toFixed(1)} km`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Phnom_Penh",
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Phnom_Penh",
  }).format(new Date(value));
}
