"use client";

import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "../landing/brand-mark";
import {
  rentalAvailability,
  rentalDate,
  rentalMoney,
  rentalTitle,
  RENTAL_TYPE_LABELS,
} from "../rentals/rental-detail-model";
import {
  FavoritesFeedback,
  FavoritesProvider,
  SaveRentalButton,
  useFavorites,
} from "./favorites-context";

export function SavedRentals() {
  return (
    <FavoritesProvider>
      <main className="saved-rentals-page" lang="en">
        <header className="site-header">
          <BrandMark />
          <nav className="rental-navigation" aria-label="Rental navigation">
            <Link href="/inquiries" prefetch={false}>
              Sent inquiries
            </Link>
            <Link href="/search">Find nearby rentals</Link>
          </nav>
        </header>
        <section
          className="saved-rentals-shell"
          aria-labelledby="favorites-title"
        >
          <header className="saved-rentals-heading">
            <h1 id="favorites-title" tabIndex={-1}>
              Saved rentals
            </h1>
            <p>
              Your private shortlist. Availability can change, so check each
              rental before arranging a visit.
            </p>
          </header>
          <FavoritesFeedback />
          <SavedContent />
        </section>
      </main>
    </FavoritesProvider>
  );
}

function SavedContent() {
  const { status, result, page, changePage } = useFavorites();
  if (status === "loading")
    return (
      <p className="saved-state" role="status">
        Loading your saved rentals…
      </p>
    );
  if (status === "guest")
    return (
      <div className="saved-state">
        <h2>Sign in to see your saved rentals</h2>
        <p>Your shortlist is private to your student account.</p>
        <Link className="favorite-action" href="/login?next=%2Ffavorites">
          Sign in
        </Link>
      </div>
    );
  if (status === "onboarding")
    return (
      <div className="saved-state">
        <h2>Complete your student profile</h2>
        <p>Finish setting up your account to save rooms.</p>
        <Link
          className="favorite-action"
          href="/onboarding/role?next=%2Ffavorites"
        >
          Continue account setup
        </Link>
      </div>
    );
  if (status === "forbidden")
    return (
      <div className="saved-state">
        <h2>Saved rentals are for student accounts</h2>
        <p>You can still explore public rental listings.</p>
        <Link href="/search">Browse nearby rentals</Link>
      </div>
    );
  if (!result) return null;
  if (result.meta.total === 0)
    return (
      <div className="saved-state">
        <h2>No saved rentals yet</h2>
        <p>
          Save rooms from search results or a rental page to compare them here.
        </p>
        <Link className="favorite-action" href="/search">
          Find rooms near your institution
        </Link>
      </div>
    );
  return (
    <>
      <p className="saved-count">
        {result.meta.total} saved{" "}
        {result.meta.total === 1 ? "rental" : "rentals"}
      </p>
      <ul className="saved-rentals-list">
        {result.data.map((favorite) => {
          const listing = favorite.listing;
          const title = listing
            ? rentalTitle(listing)
            : "Rental no longer available";
          return (
            <li key={favorite.listingId} className="saved-rental">
              {listing?.primaryImage ? (
                <div className="saved-rental-photo">
                  <Image
                    src={listing.primaryImage.publicUrl}
                    alt={
                      listing.primaryImage.altTextEn ??
                      listing.primaryImage.altTextKm ??
                      title
                    }
                    fill
                    sizes="(max-width: 600px) calc(100vw - 40px), 240px"
                  />
                </div>
              ) : (
                <div className="saved-rental-photo photo-unavailable">
                  {listing ? "Photo unavailable" : "Rental unavailable"}
                </div>
              )}
              <div className="saved-rental-copy">
                {listing ? (
                  <p className="saved-rental-price">
                    {rentalMoney(listing.monthlyPrice, listing.currency)}{" "}
                    <span>/ month</span>
                  </p>
                ) : null}
                <h2 lang={listing && !listing.titleEn ? "km" : "en"}>
                  {listing ? (
                    <Link
                      href={`/rentals/${encodeURIComponent(listing.slug)}`}
                      prefetch={false}
                    >
                      {title}
                    </Link>
                  ) : (
                    title
                  )}
                </h2>
                {listing ? (
                  <>
                    <p>
                      {RENTAL_TYPE_LABELS[listing.propertyType]} ·{" "}
                      {[
                        listing.location.commune,
                        listing.location.district,
                        listing.location.city,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p className="rental-availability">
                      <span className="availability-check" aria-hidden="true" />
                      {rentalAvailability(listing.availableFrom)}
                    </p>
                    <p>
                      Last confirmed{" "}
                      {rentalDate(listing.availabilityConfirmedAt)}
                    </p>
                  </>
                ) : (
                  <p>
                    This rental is no longer publicly available. You can remove
                    it from your shortlist.
                  </p>
                )}
                <small>
                  Saved{" "}
                  <time dateTime={favorite.savedAt}>
                    {rentalDate(favorite.savedAt)}
                  </time>
                </small>
                <SaveRentalButton
                  listingId={favorite.listingId}
                  title={title}
                  returnTo="/favorites"
                />
              </div>
            </li>
          );
        })}
      </ul>
      {result.meta.totalPages > 1 ? (
        <nav className="search-pagination" aria-label="Saved rental pages">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => changePage(page - 1)}
          >
            Previous
          </button>
          <p>
            Page <strong>{page}</strong> of {result.meta.totalPages}
          </p>
          <button
            type="button"
            disabled={page >= result.meta.totalPages}
            onClick={() => changePage(page + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}
    </>
  );
}
