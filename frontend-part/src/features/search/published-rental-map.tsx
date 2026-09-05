"use client";

import type {
  InstitutionDto,
  PublicListingDto,
  SearchViewport,
} from "@findme/contracts";
import { useEffect, useRef, useState } from "react";

import { resolveGoogleMapsBrowserConfig } from "../../config/google-maps";
import { loadGoogleMaps } from "../../lib/maps/google-maps-loader";
import { map3DFallbackLabel } from "../../lib/maps/map-3d-capability";
import { useMap3DCapability } from "../../lib/maps/use-map-3d-capability";
import { PublishedRentalMap3D } from "./published-rental-map-3d";
import {
  canRetryPublishedMap,
  MAP_VIEWPORT_DEBOUNCE_MS,
  type PublishedMapState,
} from "./search-ui-state";
import {
  normalizeSearchViewport,
  searchViewportsEqual,
} from "./search-url-state";

interface PublishedRentalMapProps {
  institution: InstitutionDto;
  listings: readonly PublicListingDto[];
  selectedListingId: string | null;
  focusListingId: string | null;
  viewport: SearchViewport | null;
  active: boolean;
  updating: boolean;
  onSelectListing: (listingId: string) => void;
  onViewportChange: (viewport: SearchViewport) => void;
  onClearViewport: () => void;
}

const mapsConfig = resolveGoogleMapsBrowserConfig({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
  mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
});

export function PublishedRentalMap({
  institution,
  listings,
  selectedListingId,
  focusListingId,
  viewport,
  active,
  updating,
  onSelectListing,
  onViewportChange,
  onClearViewport,
}: PublishedRentalMapProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const twoDControlRef = useRef<HTMLButtonElement>(null);
  const markersRef = useRef<
    Map<string, google.maps.marker.AdvancedMarkerElement>
  >(new Map());
  const institutionMarkerRef =
    useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const onSelectRef = useRef(onSelectListing);
  const onViewportChangeRef = useRef(onViewportChange);
  const viewportRef = useRef(viewport);
  const lastEmittedViewportRef = useRef<SearchViewport | null>(null);
  const previousViewportRef = useRef<SearchViewport | null>(viewport);
  const lastFitSignatureRef = useRef<string | null>(null);
  const lastMarkerFocusRef = useRef<string | null>(null);
  const [state, setState] = useState<PublishedMapState>("fallback");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d");
  const [threeDError, setThreeDError] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const threeDCapability = useMap3DCapability(mapsConfig.status);
  const focusedListing = listings.find(
    (listing) => listing.id === focusListingId,
  );
  const focusLatitude = focusedListing?.location.latitude;
  const focusLongitude = focusedListing?.location.longitude;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (!("IntersectionObserver" in window)) {
      setMapVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setMapVisible(Boolean(entry?.isIntersecting));
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    onSelectRef.current = onSelectListing;
  }, [onSelectListing]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    if (
      mapMode === "3d" &&
      (threeDCapability.status !== "enabled" || state !== "ready")
    ) {
      setMapMode("2d");
    }
  }, [mapMode, state, threeDCapability.status]);

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
    let activeInitialization = true;
    setState("loading");

    void (async () => {
      try {
        await loadGoogleMaps(config);
        const { Map: GoogleMap } = (await google.maps.importLibrary(
          "maps",
        )) as google.maps.MapsLibrary;
        if (!activeInitialization) return;
        mapRef.current = new GoogleMap(container, {
          center: { lat: institution.latitude, lng: institution.longitude },
          zoom: 14,
          mapId: config.mapId,
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          gestureHandling: "cooperative",
        });
        lastFitSignatureRef.current = null;
        setState("ready");
      } catch {
        if (activeInitialization) setState("error");
      }
    })();

    return () => {
      activeInitialization = false;
      clearMarkers(markersRef.current, institutionMarkerRef.current);
      markersRef.current = new Map();
      institutionMarkerRef.current = null;
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
    let markerPassActive = true;
    const markerEvents = new AbortController();
    const focusRequested = focusListingId !== lastMarkerFocusRef.current;
    lastMarkerFocusRef.current = focusListingId;

    void (async () => {
      const { AdvancedMarkerElement } = (await google.maps.importLibrary(
        "marker",
      )) as google.maps.MarkerLibrary;
      if (!markerPassActive || mapRef.current !== map) return;

      const previouslyFocusedId = Array.from(markersRef.current).find(
        ([, marker]) => marker.contains(document.activeElement),
      )?.[0];
      clearMarkers(markersRef.current, institutionMarkerRef.current);
      const nextMarkers = new Map<
        string,
        google.maps.marker.AdvancedMarkerElement
      >();

      const institutionMarker = new AdvancedMarkerElement({
        map,
        position: {
          lat: institution.latitude,
          lng: institution.longitude,
        },
        title: `${institution.nameEn}. Search origin.`,
        zIndex: 5,
      });
      institutionMarker.append(createInstitutionMarker(institution));
      institutionMarkerRef.current = institutionMarker;

      listings.forEach((listing) => {
        const selected = listing.id === selectedListingId;
        const marker = new AdvancedMarkerElement({
          map,
          position: {
            lat: listing.location.latitude,
            lng: listing.location.longitude,
          },
          title: `${listing.titleEn ?? listing.titleKm ?? "Rental"}. ${formatMarkerPrice(listing)} per month. ${listing.availableUnits} available.`,
          gmpClickable: true,
          zIndex: selected ? 30 : 10,
        });
        marker.append(createRentalMarker(listing, selected));
        marker.addEventListener(
          "gmp-click",
          () => onSelectRef.current(listing.id),
          { signal: markerEvents.signal },
        );
        nextMarkers.set(listing.id, marker);
      });
      markersRef.current = nextMarkers;
      const focusTarget = focusRequested ? focusListingId : previouslyFocusedId;
      if (focusTarget && mapMode === "2d") {
        nextMarkers.get(focusTarget)?.focus({ preventScroll: true });
      }

      const fitSignature = `${institution.id}:${listings
        .map((listing) => listing.id)
        .join(",")}`;
      if (
        viewportRef.current === null &&
        lastFitSignatureRef.current !== fitSignature
      ) {
        fitResultBounds(map, institution, listings);
        lastFitSignatureRef.current = fitSignature;
      }
    })().catch(() => {
      if (markerPassActive) setState("error");
    });

    return () => {
      markerPassActive = false;
      markerEvents.abort();
    };
  }, [
    focusListingId,
    institution,
    listings,
    mapMode,
    selectedListingId,
    state,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (state !== "ready" || !map) return;
    const emittedViewport = lastEmittedViewportRef.current;
    const viewportWasCleared =
      previousViewportRef.current !== null && viewport === null;

    if (viewport && !searchViewportsEqual(viewport, emittedViewport)) {
      map.fitBounds(viewportToBounds(viewport), 28);
    } else if (viewportWasCleared) {
      lastFitSignatureRef.current = null;
      fitResultBounds(map, institution, listings);
    }

    if (searchViewportsEqual(viewport, emittedViewport)) {
      lastEmittedViewportRef.current = null;
    }
    previousViewportRef.current = viewport;
  }, [institution, listings, state, viewport]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (state !== "ready" || mapMode !== "2d" || !map || !container) return;
    let userInteracted = false;
    let viewportTimer: number | null = null;
    let interactionExpiry: number | null = null;

    const markInteraction = () => {
      userInteracted = true;
      if (interactionExpiry !== null) window.clearTimeout(interactionExpiry);
      interactionExpiry = window.setTimeout(() => {
        userInteracted = false;
      }, 1_500);
    };
    const markKeyboardInteraction = (event: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "+", "-"].includes(
          event.key,
        )
      ) {
        markInteraction();
      }
    };
    const dragListener = map.addListener("dragstart", markInteraction);
    const idleListener = map.addListener("idle", () => {
      if (!userInteracted) return;
      if (viewportTimer !== null) window.clearTimeout(viewportTimer);
      viewportTimer = window.setTimeout(() => {
        const bounds = map.getBounds();
        if (!bounds) return;
        const nextViewport = normalizeSearchViewport({
          north: bounds.getNorthEast().lat(),
          south: bounds.getSouthWest().lat(),
          east: bounds.getNorthEast().lng(),
          west: bounds.getSouthWest().lng(),
        });
        userInteracted = false;
        if (interactionExpiry !== null) {
          window.clearTimeout(interactionExpiry);
          interactionExpiry = null;
        }
        if (searchViewportsEqual(viewportRef.current, nextViewport)) return;
        lastEmittedViewportRef.current = nextViewport;
        onViewportChangeRef.current(nextViewport);
      }, MAP_VIEWPORT_DEBOUNCE_MS);
    });

    container.addEventListener("pointerdown", markInteraction);
    container.addEventListener("wheel", markInteraction, { passive: true });
    container.addEventListener("keydown", markKeyboardInteraction);

    return () => {
      if (viewportTimer !== null) window.clearTimeout(viewportTimer);
      if (interactionExpiry !== null) window.clearTimeout(interactionExpiry);
      dragListener.remove();
      idleListener.remove();
      container.removeEventListener("pointerdown", markInteraction);
      container.removeEventListener("wheel", markInteraction);
      container.removeEventListener("keydown", markKeyboardInteraction);
    };
  }, [mapMode, state]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      state !== "ready" ||
      mapMode !== "2d" ||
      !map ||
      !focusListingId ||
      focusLatitude === undefined ||
      focusLongitude === undefined
    )
      return;
    const position = {
      lat: focusLatitude,
      lng: focusLongitude,
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.setCenter(position);
    } else {
      map.panTo(position);
    }
  }, [focusListingId, focusLatitude, focusLongitude, mapMode, state]);

  useEffect(() => {
    const map = mapRef.current;
    if (!active || state !== "ready" || !map) return;
    const frame = window.requestAnimationFrame(() => {
      google.maps.event.trigger(map, "resize");
      if (viewportRef.current) {
        map.fitBounds(viewportToBounds(viewportRef.current), 28);
      } else {
        fitResultBounds(map, institution, listings);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, institution, listings, state]);

  const fallbackMessage =
    state === "error"
      ? "Map unavailable. Every matching rental remains available in the list."
      : "Map preview is off. Every matching rental remains available in the list.";
  const canRetry = canRetryPublishedMap(mapsConfig.status === "READY", state);
  const showFallback = state === "fallback" || state === "error";
  const canExplore3D =
    state === "ready" &&
    mapsConfig.status === "READY" &&
    threeDCapability.status === "enabled";

  const handle3DUnavailable = (restoreControlFocus: boolean) => {
    setMapMode("2d");
    setThreeDError(true);
    if (restoreControlFocus) {
      window.requestAnimationFrame(() => twoDControlRef.current?.focus());
    }
  };

  return (
    <section
      ref={sectionRef}
      id="rental-map"
      tabIndex={-1}
      className="published-map"
      aria-labelledby="published-map-title"
    >
      <div className="published-map-heading">
        <div>
          <h2 id="published-map-title">
            Near {institution.shortName ?? institution.nameEn}
          </h2>
          <p>
            {mapMode === "3d"
              ? "Explore this result page in 3D. Use 2D search to change the area."
              : viewport
                ? "Showing the visible map area"
                : "Move the map to search this area"}
          </p>
        </div>
        <div className="published-map-heading-actions">
          {canExplore3D || mapMode === "3d" ? (
            <div
              className="published-map-view-switch"
              role="group"
              aria-label="Map view"
            >
              <button
                ref={twoDControlRef}
                type="button"
                aria-pressed={mapMode === "2d"}
                onClick={() => setMapMode("2d")}
              >
                2D search
              </button>
              <button
                type="button"
                aria-pressed={mapMode === "3d"}
                onClick={() => {
                  setThreeDError(false);
                  setMapMode("3d");
                }}
              >
                3D explore
              </button>
            </div>
          ) : null}
          {viewport ? (
            <button
              className="map-area-reset"
              type="button"
              onClick={() => {
                setMapMode("2d");
                onClearViewport();
              }}
            >
              Show full radius
            </button>
          ) : null}
        </div>
      </div>
      <div className="published-map-legend" aria-label="Map legend">
        <span className="institution-legend">Institution</span>
        <span className="available-label">
          <span className="availability-check" aria-hidden="true" />
          Available rental
        </span>
        {state === "ready" && threeDCapability.status === "fallback" ? (
          <span className="published-map-enhancement-status">
            {map3DFallbackLabel(threeDCapability.reason)}
          </span>
        ) : null}
      </div>
      <div className="published-map-frame" data-map-mode={mapMode}>
        <div
          className="published-map-fallback"
          data-visible={showFallback}
          aria-hidden={!showFallback}
        >
          <strong>{listings.length} rentals on this results page</strong>
          <p>{fallbackMessage}</p>
          {viewport || canRetry ? (
            <div className="published-map-fallback-actions">
              {viewport ? (
                <button type="button" onClick={onClearViewport}>
                  Clear map area
                </button>
              ) : null}
              {canRetry ? (
                <button
                  type="button"
                  onClick={() => setLoadAttempt((current) => current + 1)}
                >
                  Retry map
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div
          ref={containerRef}
          className="published-live-map"
          data-visible={state === "ready"}
          inert={mapMode === "3d" ? true : undefined}
          aria-hidden={state !== "ready" || mapMode === "3d"}
          role={state === "ready" && mapMode === "2d" ? "region" : undefined}
          aria-label={
            state === "ready" && mapMode === "2d"
              ? "Interactive map of matching available rentals"
              : undefined
          }
        />
        {mapMode === "3d" &&
        mapVisible &&
        canExplore3D &&
        mapsConfig.status === "READY" ? (
          <PublishedRentalMap3D
            config={mapsConfig.config}
            institution={institution}
            listings={listings}
            selectedListingId={selectedListingId}
            focusListingId={focusListingId}
            onSelectListing={onSelectListing}
            onUnavailable={handle3DUnavailable}
          />
        ) : null}
        {state === "loading" ? (
          <p className="published-map-status" role="status">
            Loading map…
          </p>
        ) : threeDError ? (
          <p className="published-map-status" role="status">
            3D view unavailable. The 2D map and rental list are ready.
          </p>
        ) : updating && mapMode === "2d" ? (
          <p className="published-map-status" role="status">
            Updating rentals in this area…
          </p>
        ) : null}
      </div>
    </section>
  );
}

function clearMarkers(
  markers: Map<string, google.maps.marker.AdvancedMarkerElement>,
  institutionMarker: google.maps.marker.AdvancedMarkerElement | null,
) {
  markers.forEach((marker) => {
    marker.map = null;
  });
  if (institutionMarker) institutionMarker.map = null;
}

function fitResultBounds(
  map: google.maps.Map,
  institution: InstitutionDto,
  listings: readonly PublicListingDto[],
) {
  if (listings.length === 0) {
    map.setCenter({ lat: institution.latitude, lng: institution.longitude });
    map.setZoom(14);
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  bounds.extend({ lat: institution.latitude, lng: institution.longitude });
  listings.forEach((listing) => {
    bounds.extend({
      lat: listing.location.latitude,
      lng: listing.location.longitude,
    });
  });
  map.fitBounds(bounds, 56);
}

function viewportToBounds(
  viewport: SearchViewport,
): google.maps.LatLngBoundsLiteral {
  return {
    north: viewport.north,
    south: viewport.south,
    east: viewport.east,
    west: viewport.west,
  };
}

function createInstitutionMarker(institution: InstitutionDto): HTMLDivElement {
  const marker = document.createElement("div");
  marker.className = "search-institution-marker";
  marker.textContent = institution.shortName ?? "School";
  return marker;
}

function createRentalMarker(
  listing: PublicListingDto,
  selected: boolean,
): HTMLDivElement {
  const marker = document.createElement("div");
  marker.className = "search-rental-marker";
  marker.dataset.selected = String(selected);

  const check = document.createElement("span");
  check.className = "search-rental-marker-check";
  check.setAttribute("aria-hidden", "true");
  marker.append(check);

  const price = document.createElement("span");
  price.textContent = formatMarkerPrice(listing);
  marker.append(price);

  if (selected) {
    const selectedLabel = document.createElement("strong");
    selectedLabel.textContent = "Selected";
    marker.append(selectedLabel);
  }
  return marker;
}

function formatMarkerPrice(listing: PublicListingDto): string {
  if (listing.currency === "USD") return `$${listing.monthlyPrice}`;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(listing.monthlyPrice)}៛`;
}
