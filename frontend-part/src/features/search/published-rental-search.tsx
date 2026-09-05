"use client";

import type {
  InstitutionDto,
  PropertyType,
  PublicListingDto,
  PublicListingSearchPage,
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
  viewAfterResultSelection,
} from "./search-ui-state";

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
  invalidFilters: boolean;
}

export function PublishedRentalSearch({
  institutionSlug,
  maxRentUsd,
  maxDistanceKm,
  propertyType,
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
  const [mobileView, setMobileView] = useState<MobileResultsView>("list");
  const searchAbortRef = useRef<AbortController | null>(null);
  const resolvedInstitutionSlugRef = useRef<string | null>(null);

  useEffect(() => {
    if (resolvedInstitutionSlugRef.current === institutionSlug) return;
    const controller = new AbortController();
    setInstitutionLoading(true);
    setInstitutionEmpty(false);
    setInstitutionsError(null);
    setInstitution(null);
    setSelectionValid(false);
    setPage(null);
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
          },
          controller.signal,
        );
        setPage(result);
        setSelectedListingId((current) =>
          current && result.data.some((listing) => listing.id === current)
            ? current
            : (result.data[0]?.id ?? null),
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error
            ? error.message
            : "FindMe could not load current rentals.";
        if (background) setRefreshError(message);
        else setSearchError(message);
      } finally {
        if (!controller.signal.aborted) setRefreshing(false);
      }
    },
    [maxDistanceKm, maxRentUsd, propertyType],
  );

  useEffect(() => {
    if (!institution) return;
    void loadResults(institution, false);

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
    setMobileView(viewAfterResultSelection("marker"));
    window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      document.getElementById(`rental-${listingId}`)?.scrollIntoView({
        behavior: resultScrollBehavior(prefersReducedMotion),
        block: "nearest",
      });
    });
  }, []);

  const selectFromCard = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
    setMobileView(viewAfterResultSelection("card"));
  }, []);

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
        <section className="search-results" aria-labelledby="results-title">
          <div className="results-heading">
            <div>
              <h2 id="results-title">
                {page.meta.total} {page.meta.total === 1 ? "room" : "rooms"}{" "}
                found
              </h2>
              <p>
                Within {formatDistance(page.meta.radiusMeters)} · last checked{" "}
                <time dateTime={page.meta.refreshedAt}>
                  {formatTime(page.meta.refreshedAt)}
                </time>
                {refreshing ? " · checking for updates" : ""}
              </p>
            </div>
            <div className="mobile-result-switch" aria-label="Results view">
              <button
                type="button"
                aria-pressed={mobileView === "list"}
                onClick={() => setMobileView("list")}
              >
                List
              </button>
              <button
                type="button"
                aria-pressed={mobileView === "map"}
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
          ) : null}

          <div
            className="published-search-layout"
            data-mobile-view={mobileView}
          >
            <PublishedRentalMap
              institution={page.meta.institution}
              listings={page.data}
              selectedListingId={selectedListingId}
              onSelectListing={selectFromMap}
            />
            <div className="published-list-region">
              {page.data.length > 0 ? (
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
              ) : (
                <div className="empty-results">
                  <h3>No published rentals match these filters.</h3>
                  <p>
                    Try increasing the distance or monthly budget. Newly
                    approved rentals will appear while this page is open.
                  </p>
                  <Link href={`/search?institution=${institution.slug}`}>
                    Reset filters
                  </Link>
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
    <li id={`rental-${listing.id}`} data-selected={selected}>
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
            <span aria-hidden="true">✓</span> {listing.availableUnits} available
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
          <button type="button" aria-pressed={selected} onClick={onSelect}>
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
      <p>Loading current published rentals…</p>
      <div className="loading-card-grid">
        <div className="skeleton loading-card" />
        <div className="skeleton loading-card" />
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
