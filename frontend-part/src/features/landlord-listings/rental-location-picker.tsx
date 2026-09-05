"use client";

import { useEffect, useRef, useState } from "react";

import { resolveGoogleMapsBrowserConfig } from "../../config/google-maps";
import { loadGoogleMaps } from "../../lib/maps/google-maps-loader";

interface RentalLocation {
  latitude: number;
  longitude: number;
}

interface RentalLocationPickerProps {
  location: RentalLocation | null;
  availableUnits: number;
  onLocationChange: (location: {
    latitude: number;
    longitude: number;
    addressLine?: string;
    googlePlaceId?: string;
  }) => void;
}

type MapState = "fallback" | "loading" | "ready" | "error";

const PHNOM_PENH_CENTER = { lat: 11.5564, lng: 104.9282 };
const mapsConfig = resolveGoogleMapsBrowserConfig({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
  mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
});

export function RentalLocationPicker({
  location,
  availableUnits,
  onLocationChange,
}: RentalLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const autocompleteContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(
    null,
  );
  const pinRef = useRef<google.maps.marker.PinElement | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const locationRef = useRef(location);
  const availableUnitsRef = useRef(availableUnits);
  const [state, setState] = useState<MapState>("fallback");

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    availableUnitsRef.current = availableUnits;
  }, [availableUnits]);

  useEffect(() => {
    const mapContainer = mapContainerRef.current;
    const autocompleteContainer = autocompleteContainerRef.current;
    if (!mapContainer || !autocompleteContainer) return;
    if (mapsConfig.status === "DISABLED") {
      setState("fallback");
      return;
    }
    if (mapsConfig.status === "INVALID") {
      setState("error");
      return;
    }
    const readyConfig = mapsConfig.config;
    const liveMapContainer = mapContainer;
    const liveAutocompleteContainer = autocompleteContainer;

    let active = true;
    const listeners: google.maps.MapsEventListener[] = [];
    setState("loading");

    async function initialize() {
      try {
        await loadGoogleMaps(readyConfig);
        const [{ Map }, { AdvancedMarkerElement, PinElement }, places] =
          await Promise.all([
            google.maps.importLibrary("maps"),
            google.maps.importLibrary("marker"),
            google.maps.importLibrary("places"),
          ]);
        if (!active) return;

        const initialLocation = locationRef.current;
        const initialAvailableUnits = availableUnitsRef.current;
        const initialAvailable = initialAvailableUnits > 0;
        const map = new Map(liveMapContainer, {
          center: initialLocation
            ? {
                lat: initialLocation.latitude,
                lng: initialLocation.longitude,
              }
            : PHNOM_PENH_CENTER,
          zoom: initialLocation ? 17 : 14,
          mapId: readyConfig.mapId,
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          gestureHandling: "cooperative",
        });
        const pin = new PinElement({
          background: initialAvailable ? "#38764b" : "#a83f35",
          borderColor: "#ffffff",
          glyphColor: "#ffffff",
          glyphText: initialAvailable ? "✓" : "×",
          scale: 1.08,
        });
        const marker = new AdvancedMarkerElement({
          map,
          gmpDraggable: true,
          ...(initialLocation
            ? {
                position: {
                  lat: initialLocation.latitude,
                  lng: initialLocation.longitude,
                },
              }
            : {}),
          title: initialAvailable
            ? `${initialAvailableUnits} rooms available. Private preview. Drag to adjust.`
            : "Currently unavailable. Private preview. Drag to adjust.",
        });
        marker.append(pin);

        listeners.push(
          map.addListener("click", (event: google.maps.MapMouseEvent) => {
            if (!event.latLng) return;
            onLocationChangeRef.current({
              latitude: event.latLng.lat(),
              longitude: event.latLng.lng(),
            });
          }),
          marker.addListener("dragend", () => {
            const point = toLiteral(marker.position);
            if (point) {
              onLocationChangeRef.current({
                latitude: point.lat,
                longitude: point.lng,
              });
            }
          }),
        );

        const autocomplete = new places.PlaceAutocompleteElement({
          includedRegionCodes: ["kh"],
          locationBias: {
            center: PHNOM_PENH_CENTER,
            radius: 30_000,
          },
        });
        autocomplete.placeholder = "Search a Phnom Penh address";
        autocomplete.setAttribute(
          "aria-label",
          "Search a Phnom Penh address for this rental",
        );
        autocomplete.addEventListener("gmp-select", (event) => {
          const prediction = (
            event as Event & {
              placePrediction?: google.maps.places.PlacePrediction;
            }
          ).placePrediction;
          if (!prediction) return;
          void (async () => {
            try {
              const place = prediction.toPlace();
              await place.fetchFields({
                fields: ["id", "formattedAddress", "location"],
              });
              if (!place.location) return;
              const nextLocation = {
                latitude: place.location.lat(),
                longitude: place.location.lng(),
                ...(place.formattedAddress
                  ? { addressLine: place.formattedAddress }
                  : {}),
                ...(place.id ? { googlePlaceId: place.id } : {}),
              };
              onLocationChangeRef.current(nextLocation);
              map.panTo(place.location);
              map.setZoom(17);
            } catch {
              setState("error");
            }
          })();
        });
        autocomplete.addEventListener("gmp-error", () => setState("error"));
        liveAutocompleteContainer.replaceChildren(autocomplete);

        markerRef.current = marker;
        pinRef.current = pin;
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    }

    void initialize();
    return () => {
      active = false;
      listeners.forEach((listener) => listener.remove());
      liveAutocompleteContainer.replaceChildren();
      liveMapContainer.replaceChildren();
      markerRef.current = null;
      pinRef.current = null;
    };
  }, []);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.position = location
      ? { lat: location.latitude, lng: location.longitude }
      : null;
  }, [location]);

  useEffect(() => {
    const marker = markerRef.current;
    const pin = pinRef.current;
    if (!marker || !pin) return;
    const available = availableUnits > 0;
    marker.title = available
      ? `${availableUnits} rooms available. Private preview. Drag to adjust.`
      : "Currently unavailable. Private preview. Drag to adjust.";
    pin.background = available ? "#38764b" : "#a83f35";
    pin.glyphText = available ? "✓" : "×";
  }, [availableUnits]);

  const isAvailable = availableUnits > 0;
  return (
    <section
      className="rental-location-preview"
      aria-labelledby="private-map-title"
    >
      <div className="private-map-heading">
        <div>
          <h3 id="private-map-title">Private map preview</h3>
          <p>Only you can see this pin until the listing is published.</p>
        </div>
        <span className="private-preview-label">Not public</span>
      </div>

      <div
        ref={autocompleteContainerRef}
        className="place-autocomplete-host"
        data-visible={state === "ready"}
      />
      <div className="location-map-frame">
        <div className="location-map-fallback" aria-hidden="true">
          <span className="fallback-road fallback-road-one" />
          <span className="fallback-road fallback-road-two" />
          {location ? (
            <span className="private-map-pin" data-available={isAvailable}>
              <strong aria-hidden="true">{isAvailable ? "✓" : "×"}</strong>
              <small>{isAvailable ? "Available" : "Unavailable"}</small>
            </span>
          ) : (
            <span className="private-map-target">Choose a location</span>
          )}
        </div>
        <div
          ref={mapContainerRef}
          className="location-live-map"
          data-visible={state === "ready"}
          aria-hidden="true"
        />
        {state === "loading" ? (
          <p className="location-map-status" role="status">
            Loading the location picker…
          </p>
        ) : null}
        {state === "fallback" || state === "error" ? (
          <p className="location-map-status">
            {state === "error"
              ? "Map unavailable. Enter coordinates below to keep going."
              : "Map preview is off. Enter coordinates below to keep going."}
          </p>
        ) : null}
      </div>
      <p className="location-accessible-summary" role="status">
        {location
          ? `Selected coordinates ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}. ${isAvailable ? `${availableUnits} rooms available.` : "Currently unavailable."}`
          : "No rental location selected yet."}
      </p>
    </section>
  );
}

function toLiteral(
  position:
    | google.maps.LatLng
    | google.maps.LatLngLiteral
    | google.maps.LatLngAltitude
    | google.maps.LatLngAltitudeLiteral
    | null
    | undefined,
): google.maps.LatLngLiteral | null {
  if (!position) return null;
  const latitude = position.lat;
  const longitude = position.lng;
  if (typeof latitude === "function" && typeof longitude === "function") {
    return {
      lat: latitude.call(position),
      lng: longitude.call(position),
    };
  }
  if (typeof latitude === "number" && typeof longitude === "number") {
    return { lat: latitude, lng: longitude };
  }
  return null;
}
