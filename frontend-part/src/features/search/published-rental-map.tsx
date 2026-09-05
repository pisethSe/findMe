"use client";

import type { InstitutionDto, PublicListingDto } from "@findme/contracts";
import { useEffect, useRef, useState } from "react";

import { resolveGoogleMapsBrowserConfig } from "../../config/google-maps";
import { loadGoogleMaps } from "../../lib/maps/google-maps-loader";
import {
  canRetryPublishedMap,
  type PublishedMapState,
} from "./search-ui-state";

interface PublishedRentalMapProps {
  institution: InstitutionDto;
  listings: readonly PublicListingDto[];
  selectedListingId: string | null;
  onSelectListing: (listingId: string) => void;
}

const mapsConfig = resolveGoogleMapsBrowserConfig({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
  mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
});

export function PublishedRentalMap({
  institution,
  listings,
  selectedListingId,
  onSelectListing,
}: PublishedRentalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const onSelectRef = useRef(onSelectListing);
  const [state, setState] = useState<PublishedMapState>("fallback");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    onSelectRef.current = onSelectListing;
  }, [onSelectListing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (mapsConfig.status === "DISABLED") {
      setState("fallback");
      return;
    }
    if (mapsConfig.status === "INVALID") {
      setState("error");
      return;
    }
    const config = mapsConfig.config;
    let active = true;
    setState("loading");

    void (async () => {
      try {
        await loadGoogleMaps(config);
        const { Map } = (await google.maps.importLibrary(
          "maps",
        )) as google.maps.MapsLibrary;
        if (!active) return;
        mapRef.current = new Map(container, {
          center: { lat: institution.latitude, lng: institution.longitude },
          zoom: 14,
          mapId: config.mapId,
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          gestureHandling: "cooperative",
        });
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();

    return () => {
      active = false;
      markersRef.current.forEach((marker) => {
        marker.map = null;
      });
      markersRef.current = [];
      mapRef.current = null;
      container.replaceChildren();
    };
  }, [
    institution.id,
    institution.latitude,
    institution.longitude,
    loadAttempt,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (state !== "ready" || !map) return;
    let active = true;
    const listeners: google.maps.MapsEventListener[] = [];

    void (async () => {
      const { AdvancedMarkerElement, PinElement } =
        (await google.maps.importLibrary(
          "marker",
        )) as google.maps.MarkerLibrary;
      if (!active || mapRef.current !== map) return;

      markersRef.current.forEach((marker) => {
        marker.map = null;
      });
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: institution.latitude, lng: institution.longitude });
      markersRef.current = listings.map((listing) => {
        const selected = listing.id === selectedListingId;
        const pin = new PinElement({
          background: selected ? "#195c35" : "#38764b",
          borderColor: "#ffffff",
          glyphColor: "#ffffff",
          glyphText: "✓",
          scale: selected ? 1.22 : 1.05,
        });
        const marker = new AdvancedMarkerElement({
          map,
          position: {
            lat: listing.location.latitude,
            lng: listing.location.longitude,
          },
          title: `${listing.titleEn ?? listing.titleKm ?? "Rental"}. ${listing.availableUnits} rooms available.`,
          gmpClickable: true,
        });
        marker.append(pin);
        listeners.push(
          marker.addListener("click", () => onSelectRef.current(listing.id)),
        );
        bounds.extend({
          lat: listing.location.latitude,
          lng: listing.location.longitude,
        });
        return marker;
      });
      if (listings.length > 0) map.fitBounds(bounds, 56);
    })().catch(() => setState("error"));

    return () => {
      active = false;
      listeners.forEach((listener) => listener.remove());
    };
  }, [institution, listings, selectedListingId, state]);

  const fallbackMessage =
    state === "error"
      ? "Map unavailable. All matching rentals remain available in the list."
      : "Map preview is off. All matching rentals are available in the list.";
  const canRetry = canRetryPublishedMap(mapsConfig.status === "READY", state);
  const showFallback = state === "fallback" || state === "error";

  return (
    <section className="published-map" aria-labelledby="published-map-title">
      <div className="published-map-heading">
        <div>
          <p>Live area</p>
          <h2 id="published-map-title">
            Near {institution.shortName ?? institution.nameEn}
          </h2>
        </div>
        <span className="available-label">
          <span aria-hidden="true">✓</span> Available
        </span>
      </div>
      <div className="published-map-frame">
        <div
          className="published-map-fallback"
          data-visible={showFallback}
          aria-hidden={!showFallback}
        >
          <strong>{listings.length} matching rentals</strong>
          <p>{fallbackMessage}</p>
          {canRetry ? (
            <button
              type="button"
              onClick={() => setLoadAttempt((current) => current + 1)}
            >
              Retry map
            </button>
          ) : null}
        </div>
        <div
          ref={containerRef}
          className="published-live-map"
          data-visible={state === "ready"}
          aria-hidden={state !== "ready"}
          role={state === "ready" ? "region" : undefined}
          aria-label={
            state === "ready"
              ? "Interactive map of matching available rentals"
              : undefined
          }
        />
        {state === "loading" ? (
          <p className="published-map-status" role="status">
            Loading map…
          </p>
        ) : null}
      </div>
    </section>
  );
}
