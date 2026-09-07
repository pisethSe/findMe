import type { PublicListingDetailDto } from "@findme/contracts";
import Link from "next/link";

import { RentalFavorite } from "../favorites/favorites-context";
import { InquiryForm } from "../inquiries/inquiry-form";
import { BrandMark } from "../landing/brand-mark";
import { RentalGallery } from "./rental-gallery";
import { RentalRefresh } from "./rental-refresh";
import {
  phoneHref,
  rentalAvailability,
  rentalDate,
  rentalMoney,
  rentalTitle,
  telegramHref,
  RENTAL_TYPE_LABELS,
} from "./rental-detail-model";

/* THESIS: A student can judge one room without losing their school search.
   OWN-WORLD: Inherit FindMe's Kantumruy type, olive controls and quiet neutrals.
   STORY: Photos and price, then practical costs, rules and school-relative location.
   FIRST VIEWPORT: Rental identity, one generous photo and a compact rent/contact summary.
   FORM: Two unequal desktop columns; a single reading order on phones.
   FINISH: Real public records, explicit missing data, keyboard controls, no decorative motion. */
export function RentalDetail({
  rental,
  backHref,
  missingInstitution,
}: {
  rental: PublicListingDetailDto;
  backHref: string;
  missingInstitution: boolean;
}) {
  const title = rentalTitle(rental);
  const phone = phoneHref(rental.contact.phone);
  const telegram = telegramHref(rental.contact.telegram);
  const coordinates = `${rental.location.latitude},${rental.location.longitude}`;
  const mapHref = `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: coordinates })}`;
  return (
    <main className="rental-detail-page" lang="en">
      <RentalRefresh />
      <header className="site-header">
        <BrandMark />
        <nav className="rental-navigation" aria-label="Rental navigation">
          <Link href="/favorites" prefetch={false}>
            Saved rentals
          </Link>
          <Link href="/inquiries" prefetch={false}>
            Sent inquiries
          </Link>
          <Link href={backHref}>Back to results</Link>
        </nav>
      </header>
      <article className="rental-detail-shell">
        <header className="rental-detail-heading">
          <h1 lang={rental.titleEn ? "en" : "km"}>{title}</h1>
          {rental.titleEn && rental.titleKm ? (
            <p lang="km">{rental.titleKm}</p>
          ) : null}
          <p>
            {RENTAL_TYPE_LABELS[rental.propertyType]} ·{" "}
            {[
              rental.location.commune,
              rental.location.district,
              rental.location.city,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          {rental.institution && rental.distanceMeters !== null ? (
            <p>
              <strong>
                {rental.distanceMeters < 1000
                  ? `${rental.distanceMeters} m`
                  : `${(rental.distanceMeters / 1000).toFixed(1)} km`}{" "}
                from {rental.institution.shortName ?? rental.institution.nameEn}
              </strong>{" "}
              · straight-line distance, not walking distance
            </p>
          ) : null}
          {missingInstitution ? (
            <p role="status">
              That institution is unavailable. The rental is shown without a
              distance; choose an institution in search.
            </p>
          ) : null}
        </header>
        <div className="rental-detail-grid">
          <RentalGallery
            key={rental.images.map(({ id }) => id).join(":")}
            images={rental.images}
            title={title}
          />
          <aside
            className="rental-summary"
            aria-label="Rent, availability and contact"
          >
            <p className="rental-monthly-price">
              <strong>
                {rentalMoney(rental.monthlyPrice, rental.currency)}
              </strong>{" "}
              / month
            </p>
            <p className="rental-availability">
              <span className="availability-check" aria-hidden="true" />
              {rentalAvailability(rental.availableFrom)}
            </p>
            <p>
              {rental.availableUnits}{" "}
              {rental.availableUnits === 1 ? "unit" : "units"} available
            </p>
            <p className="rental-detail-muted">
              Last confirmed{" "}
              <time dateTime={rental.availabilityConfirmedAt}>
                {rentalDate(rental.availabilityConfirmedAt)}
              </time>
            </p>
            <dl className="rental-costs">
              <div>
                <dt>Deposit</dt>
                <dd>
                  {rental.depositAmount === null
                    ? "Not provided"
                    : rentalMoney(rental.depositAmount, rental.currency)}
                </dd>
              </div>
            </dl>
            <RentalFavorite
              listingId={rental.id}
              title={title}
              slug={rental.slug}
            />
            <h2>Contact the landlord</h2>
            <a className="rental-contact-action" href="#rental-inquiry">
              Send an inquiry
            </a>
            {rental.contact.displayName ? (
              <p>{rental.contact.displayName}</p>
            ) : null}
            {phone ? (
              <a className="rental-contact-action" href={phone}>
                Call {rental.contact.phone}
              </a>
            ) : null}
            {telegram ? (
              <a
                className="rental-contact-action"
                href={telegram}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Telegram{" "}
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : null}
            {!phone && !telegram ? (
              <p className="rental-detail-muted">
                {rental.contact.preference === "IN_APP_ONLY"
                  ? "This landlord prefers inquiries through FindMe."
                  : "No public contact channel is currently available for this rental."}
              </p>
            ) : null}
            <p className="rental-detail-muted">
              Confirm availability, utility charges, and deposit terms with the
              landlord before arranging a viewing.
            </p>
            <Link href={backHref}>Keep browsing nearby rentals</Link>
          </aside>
          <div className="rental-detail-sections">
            <InquiryForm
              key={rental.id}
              listingId={rental.id}
              slug={rental.slug}
            />
            <section aria-labelledby="about-rental">
              <h2 id="about-rental">About this rental</h2>
              <RentalText
                en={rental.descriptionEn}
                km={rental.descriptionKm}
                fallback="No description has been provided."
              />
              <dl className="rental-facts">
                <div>
                  <dt>Rental type</dt>
                  <dd>{RENTAL_TYPE_LABELS[rental.propertyType]}</dd>
                </div>
                <div>
                  <dt>Bedrooms</dt>
                  <dd>{rental.bedrooms ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt>Bathrooms</dt>
                  <dd>{rental.bathrooms ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt>Furnishing</dt>
                  <dd>{rental.furnished ? "Furnished" : "Unfurnished"}</dd>
                </div>
              </dl>
            </section>
            <section aria-labelledby="rental-amenities">
              <h2 id="rental-amenities">Amenities</h2>
              {rental.amenities.length ? (
                <ul className="rental-detail-amenities">
                  {rental.amenities.map((amenity) => (
                    <li key={amenity.id}>
                      {amenity.nameEn}
                      <span lang="km">{amenity.nameKm}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No amenities have been specified.</p>
              )}
            </section>
            <section aria-labelledby="rental-utilities">
              <h2 id="rental-utilities">Utilities and other costs</h2>
              <RentalText
                en={rental.utilityNotesEn}
                km={rental.utilityNotesKm}
                fallback="Utility charges have not been provided. Ask whether water, electricity, internet, and parking are included in the monthly rent."
              />
            </section>
            <section aria-labelledby="rental-rules">
              <h2 id="rental-rules">House rules</h2>
              <RentalText
                en={rental.houseRulesEn}
                km={rental.houseRulesKm}
                fallback="No house rules have been provided. Check visitor, parking, and quiet-hour arrangements with the landlord."
              />
            </section>
            <section aria-labelledby="rental-location">
              <h2 id="rental-location">Location</h2>
              <p>{rental.location.addressLine}</p>
              <p>
                {[
                  rental.location.commune,
                  rental.location.district,
                  rental.location.city,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {rental.institution ? (
                <p>
                  Selected institution: {rental.institution.nameEn}
                  <br />
                  <span lang="km">{rental.institution.nameKm}</span>
                </p>
              ) : (
                <p>
                  Select an institution in search to see its distance from this
                  rental.
                </p>
              )}
              <a href={mapHref} target="_blank" rel="noopener noreferrer">
                View location in Google Maps{" "}
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              <p className="rental-detail-muted">
                Location supplied by the landlord. Straight-line distance does
                not account for roads or access routes.
              </p>
            </section>
            <p className="rental-detail-muted">
              Listing updated{" "}
              <time dateTime={rental.updatedAt}>
                {rentalDate(rental.updatedAt)}
              </time>
              . Availability was confirmed separately above.
            </p>
          </div>
        </div>
      </article>
    </main>
  );
}

function RentalText({
  en,
  km,
  fallback,
}: {
  en: string | null;
  km: string | null;
  fallback: string;
}) {
  return (
    <div className="rental-long-text">
      {en ? <p lang="en">{en}</p> : null}
      {km ? <p lang="km">{km}</p> : null}
      {!en && !km ? <p>{fallback}</p> : null}
    </div>
  );
}
