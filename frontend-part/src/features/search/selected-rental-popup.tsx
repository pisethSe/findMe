"use client";

import type { InstitutionDto, PublicListingDto } from "@findme/contracts";
import Image from "next/image";
import Link from "next/link";
import { type KeyboardEvent, type RefObject } from "react";

import { Localized } from "../preferences/translated-text";
import {
  describeAvailableUnits,
  formatAvailabilityDate,
  formatListingDistance,
  formatListingPrice,
  rentalPropertyTypeLabel,
} from "./rental-card-format.ts";

/**
 * The map popup for the rental selected by a marker or a card. It repeats the
 * rental in text form, so the map is never the only way to read availability,
 * price, distance, or the photo.
 */
export function SelectedRentalPopup({
  listing,
  institution,
  detailHref,
  popupRef,
  onClose,
  onShowList,
}: {
  listing: PublicListingDto;
  institution: InstitutionDto;
  detailHref: string;
  popupRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onShowList: () => void;
}) {
  const title = listing.titleEn ?? listing.titleKm ?? "Student rental";
  const available = listing.availableUnits > 0;
  const location =
    [listing.location.commune, listing.location.district, listing.location.city]
      .filter(Boolean)
      .join(", ") || listing.location.city;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose();
  }

  return (
    <Localized>
      <aside
        ref={popupRef}
        className="published-map-popup"
        role="region"
        aria-label="Selected rental"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="published-map-popup-photo">
          {listing.primaryImage ? (
            <Image
              src={listing.primaryImage.publicUrl}
              alt={
                listing.primaryImage.altTextEn ??
                listing.primaryImage.altTextKm ??
                title
              }
              fill
              sizes="(max-width: 640px) 88vw, 300px"
            />
          ) : (
            <span>Photo unavailable</span>
          )}
        </div>
        <div className="published-map-popup-copy">
          <div className="price-row">
            <strong>
              {formatListingPrice(listing.monthlyPrice, listing.currency)}/month
            </strong>
            <span className="available-label" data-available={available}>
              <span
                className={
                  available ? "availability-check" : "availability-cross"
                }
                aria-hidden="true"
              />
              {describeAvailableUnits(listing.availableUnits)}
            </span>
          </div>
          <h3 lang={listing.titleEn ? "en" : "km"}>
            <Link href={detailHref} prefetch={false}>
              {title}
            </Link>
          </h3>
          <p>
            {rentalPropertyTypeLabel(listing.propertyType)} ·{" "}
            {formatListingDistance(listing.distanceMeters)} from{" "}
            {institution.shortName ?? institution.nameEn}
          </p>
          <p className="location-context">{location}</p>
          <small>
            Last confirmed{" "}
            {formatAvailabilityDate(listing.availabilityConfirmedAt)}
          </small>
          <div className="published-map-popup-actions">
            <Link href={detailHref} prefetch={false}>
              View rental
            </Link>
            <button type="button" onClick={onShowList}>
              Show in list
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </aside>
    </Localized>
  );
}
