"use client";

import type { InstitutionDto, PublicListingDto } from "@findme/contracts";
import { useEffect, useMemo, useRef, useState } from "react";

import type { GoogleMapsBrowserConfig } from "../../config/google-maps";
import { loadGoogleMaps } from "../../lib/maps/google-maps-loader";
import {
  AVAILABLE_3D_GLYPH_SRC,
  map3DSceneRange,
  SEARCH_3D_MARKER_BUDGET,
} from "../../lib/maps/map-3d-scene";
import { createMap3DSession } from "../../lib/maps/map-3d-session";

interface PublishedRentalMap3DProps {
  config: GoogleMapsBrowserConfig;
  institution: InstitutionDto;
  listings: readonly PublicListingDto[];
  selectedListingId: string | null;
  focusListingId: string | null;
  onSelectListing: (listingId: string) => void;
  onUnavailable: (restoreControlFocus: boolean) => void;
}

export function PublishedRentalMap3D({
  config,
  institution,
  listings,
  selectedListingId,
  focusListingId,
  onSelectListing,
  onUnavailable,
}: PublishedRentalMap3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.maps3d.Map3DElement | null>(null);
  const markerRefs = useRef<
    Map<string, google.maps.maps3d.Marker3DInteractiveElement>
  >(new Map());
  const onSelectRef = useRef(onSelectListing);
  const onUnavailableRef = useRef(onUnavailable);
  const sessionRef = useRef<ReturnType<typeof createMap3DSession> | null>(null);
  const lastFitSignatureRef = useRef<string | null>(null);
  const lastMarkerFocusRef = useRef<string | null>(null);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const sceneListings = useMemo(
    () => listings.slice(0, SEARCH_3D_MARKER_BUDGET),
    [listings],
  );
  const origin = useMemo(
    () => ({
      latitude: institution.latitude,
      longitude: institution.longitude,
    }),
    [institution.latitude, institution.longitude],
  );
  const scenePoints = useMemo(
    () =>
      sceneListings.map((listing) => ({
        latitude: listing.location.latitude,
        longitude: listing.location.longitude,
      })),
    [sceneListings],
  );
  const sceneRef = useRef({ origin, points: scenePoints });
  const sceneSignature = sceneListings
    .map(
      (listing) =>
        `${listing.id}:${listing.location.latitude}:${listing.location.longitude}`,
    )
    .join(",");
  const focusedListing = sceneListings.find(
    (listing) => listing.id === focusListingId,
  );
  const focusLatitude = focusedListing?.location.latitude;
  const focusLongitude = focusedListing?.location.longitude;

  useEffect(() => {
    sceneRef.current = { origin, points: scenePoints };
  }, [origin, scenePoints]);

  useEffect(() => {
    onSelectRef.current = onSelectListing;
  }, [onSelectListing]);

  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const session = createMap3DSession({
      onReady: () => setState("ready"),
      onUnavailable: () =>
        onUnavailableRef.current(container.contains(document.activeElement)),
    });
    sessionRef.current = session;
    lastFitSignatureRef.current = null;
    lastMarkerFocusRef.current = null;
    setState("loading");

    void (async () => {
      try {
        await loadGoogleMaps(config);
        if (!session.isActive()) return;
        const [{ Map3DElement }] = await Promise.all([
          google.maps.importLibrary("maps3d"),
          google.maps.importLibrary("marker"),
        ]);
        if (!session.isActive()) return;
        const scene = sceneRef.current;

        const map = new Map3DElement({
          center: {
            lat: institution.latitude,
            lng: institution.longitude,
            altitude: 24,
          },
          range: map3DSceneRange(
            scene.origin,
            scene.points,
            mapAspectRatio(container),
          ),
          tilt: 55,
          heading: 18,
          fov: 42,
          mode: "HYBRID",
          gestureHandling: "COOPERATIVE",
          defaultUIHidden: false,
          description: `Three-dimensional view of available rentals near ${institution.nameEn}.`,
          mapId: config.mapId,
        });
        map.className = "published-3d-map-element";
        mapRef.current = map;

        const stopAnimation = () => map.stopCameraAnimation();
        const handleVisibility = () => {
          if (document.hidden) stopAnimation();
        };
        map.addEventListener("pointerdown", stopAnimation, {
          capture: true,
          signal: session.signal,
        });
        map.addEventListener("wheel", stopAnimation, {
          passive: true,
          capture: true,
          signal: session.signal,
        });
        map.addEventListener("keydown", stopAnimation, {
          capture: true,
          signal: session.signal,
        });
        document.addEventListener("visibilitychange", handleVisibility, {
          signal: session.signal,
        });
        session.attach(map);
        container.replaceChildren(map);
      } catch {
        session.fail();
      }
    })();

    return () => {
      if (container.contains(document.activeElement)) {
        document.getElementById("rental-map")?.focus({ preventScroll: true });
      }
      session.dispose();
      sessionRef.current = null;
      mapRef.current = null;
      markerRefs.current.clear();
      container.replaceChildren();
    };
  }, [
    config,
    institution.id,
    institution.latitude,
    institution.longitude,
    institution.nameEn,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (
      state !== "ready" ||
      !map ||
      !container ||
      lastFitSignatureRef.current === sceneSignature
    )
      return;
    lastFitSignatureRef.current = sceneSignature;
    const scene = sceneRef.current;
    try {
      map.stopCameraAnimation();
      map.center = {
        lat: scene.origin.latitude,
        lng: scene.origin.longitude,
        altitude: 24,
      };
      map.range = map3DSceneRange(
        scene.origin,
        scene.points,
        mapAspectRatio(container),
      );
    } catch {
      sessionRef.current?.fail();
    }
  }, [sceneSignature, state]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (
      state !== "ready" ||
      !map ||
      !container ||
      !("ResizeObserver" in window)
    )
      return;
    let previousAspect = mapAspectRatio(container);
    const observer = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return;
      const aspect = mapAspectRatio(container);
      if (Math.abs(aspect - previousAspect) < 0.01) return;
      previousAspect = aspect;
      const scene = sceneRef.current;
      try {
        map.stopCameraAnimation();
        map.center = {
          lat: scene.origin.latitude,
          lng: scene.origin.longitude,
          altitude: 24,
        };
        map.range = map3DSceneRange(scene.origin, scene.points, aspect);
      } catch {
        sessionRef.current?.fail();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [state]);

  useEffect(() => {
    const map = mapRef.current;
    if (state !== "ready" || !map) return;
    const listeners = new AbortController();
    let active = true;
    const focusRequested = focusListingId !== lastMarkerFocusRef.current;
    lastMarkerFocusRef.current = focusListingId;

    void (async () => {
      const [{ Marker3DElement, Marker3DInteractiveElement }, { PinElement }] =
        await Promise.all([
          google.maps.importLibrary("maps3d"),
          google.maps.importLibrary("marker"),
        ]);
      if (!active || mapRef.current !== map || !sessionRef.current?.isActive())
        return;

      const previouslyFocusedId = Array.from(markerRefs.current).find(
        ([, marker]) => marker.contains(document.activeElement),
      )?.[0];
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current.clear();
      map.querySelector(".published-3d-institution")?.remove();

      const institutionPin = new PinElement({
        background: "oklch(0.24 0.035 118)",
        borderColor: "oklch(1 0 0)",
        glyphColor: "oklch(1 0 0)",
        glyphText: "U",
        scale: 1.1,
      });
      const institutionMarker = new Marker3DElement({
        position: {
          lat: institution.latitude,
          lng: institution.longitude,
          altitude: 10,
        },
        label: `${institution.nameEn}. Search origin.`,
        sizePreserved: true,
        zIndex: 40,
      });
      institutionMarker.className = "published-3d-institution";
      institutionMarker.append(institutionPin);
      map.append(institutionMarker);

      const nextMarkers = new Map<
        string,
        google.maps.maps3d.Marker3DInteractiveElement
      >();
      sceneListings.forEach((listing) => {
        const selected = listing.id === selectedListingId;
        const title = `${selected ? "Selected. " : ""}${listing.titleEn ?? listing.titleKm ?? "Rental"}. ${formatMarkerPrice(listing)} per month. ${listing.availableUnits} available.`;
        const pin = new PinElement({
          background: "oklch(0.48 0.13 142)",
          borderColor: selected ? "oklch(0.24 0.035 118)" : "oklch(1 0 0)",
          glyphSrc: AVAILABLE_3D_GLYPH_SRC,
          scale: selected ? 1.45 : 1.16,
        });
        const marker = new Marker3DInteractiveElement({
          position: {
            lat: listing.location.latitude,
            lng: listing.location.longitude,
            altitude: 10,
          },
          title,
          label: `${selected ? "Selected · " : ""}${formatMarkerPrice(listing)} · Available`,
          collisionBehavior: selected
            ? "REQUIRED"
            : "OPTIONAL_AND_HIDES_LOWER_PRIORITY",
          collisionPriority: selected ? 100 : 10,
          drawsWhenOccluded: true,
          sizePreserved: true,
          zIndex: selected ? 30 : 10,
        });
        marker.className = "published-3d-rental";
        marker.dataset.selected = String(selected);
        marker.append(pin);
        marker.addEventListener(
          "gmp-click",
          () => onSelectRef.current(listing.id),
          { signal: listeners.signal },
        );
        map.append(marker);
        nextMarkers.set(listing.id, marker);
      });
      markerRefs.current = nextMarkers;
      const focusTarget = focusRequested ? focusListingId : previouslyFocusedId;
      if (focusTarget) {
        nextMarkers.get(focusTarget)?.focus({ preventScroll: true });
      }
    })().catch(() => {
      if (active) {
        sessionRef.current?.fail();
      }
    });

    return () => {
      active = false;
      listeners.abort();
    };
  }, [focusListingId, institution, sceneListings, selectedListingId, state]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      state !== "ready" ||
      !map ||
      !focusListingId ||
      focusLatitude === undefined ||
      focusLongitude === undefined ||
      document.hidden
    )
      return;
    try {
      map.stopCameraAnimation();
      map.flyCameraTo({
        endCamera: {
          center: {
            lat: focusLatitude,
            lng: focusLongitude,
            altitude: 18,
          },
          range: 1_350,
          tilt: 60,
          heading: map.heading ?? 18,
        },
        durationMillis: 650,
      });
    } catch {
      sessionRef.current?.fail();
    }
  }, [focusListingId, focusLatitude, focusLongitude, state]);

  return (
    <div className="published-3d-map" data-ready={state === "ready"}>
      <div
        ref={containerRef}
        className="published-3d-map-host"
        inert={state !== "ready"}
        aria-hidden={state !== "ready"}
        role={state === "ready" ? "region" : undefined}
        aria-label={
          state === "ready"
            ? "Interactive three-dimensional map of matching available rentals"
            : undefined
        }
      />
      {state === "loading" ? (
        <p className="published-map-status" role="status">
          Preparing 3D view…
        </p>
      ) : null}
    </div>
  );
}

function mapAspectRatio(container: HTMLElement): number {
  return container.clientHeight > 0
    ? container.clientWidth / container.clientHeight
    : 1;
}

function formatMarkerPrice(listing: PublicListingDto): string {
  if (listing.currency === "USD") return `$${listing.monthlyPrice}`;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(listing.monthlyPrice)}៛`;
}
