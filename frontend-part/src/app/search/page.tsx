import type { Metadata } from "next";
import Link from "next/link";

import { createDemoListings, DEMO_UNIVERSITIES } from "../../data/demo";
import { ROOM_TYPES, searchListings, type RoomType } from "../../domain/search";
import { BrandMark } from "../../features/landing/brand-mark";

export const metadata: Metadata = {
  title: "Browse nearby rentals",
  robots: { index: false, follow: false },
};

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  private_room: "Private room",
  shared_room: "Shared room",
  studio: "Studio",
  house: "House",
};

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositive(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const requestedUniversity = firstValue(params.university) ?? "rupp";
  const matchedUniversity = DEMO_UNIVERSITIES.find(
    (candidate) => candidate.slug === requestedUniversity,
  );
  const university = matchedUniversity ?? DEMO_UNIVERSITIES.at(0);
  if (!university) {
    throw new Error("No demonstration institutions are configured.");
  }
  const requestedRoomType = firstValue(params.roomType);
  const roomType = ROOM_TYPES.includes(requestedRoomType as RoomType)
    ? (requestedRoomType as RoomType)
    : undefined;
  const requestedMaxRent = firstValue(params.maxRentUsd);
  const requestedMaxDistance = firstValue(params.maxDistanceKm);
  const parsedMaxRent = parsePositive(requestedMaxRent);
  const parsedMaxDistance = parsePositive(requestedMaxDistance);
  const maxRentUsd = parsedMaxRent ?? 300;
  const maxDistanceKm = parsedMaxDistance ?? 5;
  const invalidFilters =
    !matchedUniversity ||
    (requestedRoomType !== undefined &&
      requestedRoomType !== "" &&
      roomType === undefined) ||
    (requestedMaxRent !== undefined && parsedMaxRent === undefined) ||
    (requestedMaxDistance !== undefined && parsedMaxDistance === undefined);
  const results = searchListings(DEMO_UNIVERSITIES, createDemoListings(), {
    universitySlug: university.slug,
    maxRentUsdMinor: Math.round(maxRentUsd * 100),
    maxDistanceKm,
    ...(roomType ? { roomType } : {}),
  });

  return (
    <main className="search-page">
      <header className="site-header search-header">
        <BrandMark />
        <Link href="/">Back to home</Link>
      </header>

      <section className="search-intro">
        <div>
          <p className="hero-context">Demonstration search</p>
          <h1>Rooms near {university.nameEn}</h1>
          <p>
            These records demonstrate filtering and eligibility rules. They are
            not live rental advertisements.
          </p>
        </div>

        <form className="filter-form" action="/search" method="get">
          <label>
            University
            <select name="university" defaultValue={university.slug}>
              {DEMO_UNIVERSITIES.map((item) => (
                <option value={item.slug} key={item.slug}>
                  {item.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label>
            Maximum rent (USD)
            <input
              name="maxRentUsd"
              type="number"
              min="1"
              inputMode="numeric"
              defaultValue={maxRentUsd}
            />
          </label>
          <label>
            Maximum distance (km)
            <input
              name="maxDistanceKm"
              type="number"
              min="0.1"
              step="0.1"
              inputMode="decimal"
              defaultValue={maxDistanceKm}
            />
          </label>
          <label>
            Room type
            <select name="roomType" defaultValue={roomType ?? ""}>
              <option value="">All room types</option>
              {ROOM_TYPES.map((type) => (
                <option value={type} key={type}>
                  {ROOM_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Update results</button>
        </form>
      </section>

      {invalidFilters ? (
        <p className="filter-warning" role="alert">
          One or more shared filters were invalid, so safe defaults are shown.
          Review the filters and update the results.
        </p>
      ) : null}

      <section className="search-results" aria-labelledby="results-title">
        <div className="results-heading">
          <h2 id="results-title">
            {results.length} {results.length === 1 ? "room" : "rooms"} found
          </h2>
          <p>Sorted by student-usefulness score</p>
        </div>

        {results.length > 0 ? (
          <ul className="rental-results">
            {results.map(({ listing, distanceKm }) => (
              <li key={listing.id}>
                <div
                  className="photo-unavailable"
                  aria-label="Photo unavailable"
                >
                  <span>Photo unavailable</span>
                </div>
                <div className="rental-card-copy">
                  <div className="price-row">
                    <strong>${listing.baseRentUsdMinor / 100}/month</strong>
                    <span className="available-label">
                      <span aria-hidden="true">✓</span>{" "}
                      {listing.dataSource === "demo"
                        ? "Demo availability"
                        : "Available now"}
                    </span>
                  </div>
                  <h3>{listing.titleEn}</h3>
                  <p>
                    {ROOM_TYPE_LABELS[listing.roomType]} · {distanceKm} km from{" "}
                    {university.slug.toUpperCase()}
                  </p>
                  <p className="location-context">
                    {listing.locationContextEn}
                  </p>
                  <ul className="amenity-list" aria-label="Key amenities">
                    {listing.amenities.slice(0, 3).map((amenity) => (
                      <li key={amenity}>{amenity.replaceAll("-", " ")}</li>
                    ))}
                  </ul>
                  <small>
                    Last confirmed{" "}
                    {listing.confirmedAt
                      ? listing.confirmedAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "Asia/Phnom_Penh",
                        })
                      : "not yet"}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-results">
            <h3>No demonstration rooms match these filters.</h3>
            <p>Try increasing the distance or monthly budget.</p>
            <Link href={`/search?university=${university.slug}`}>
              Reset filters
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
