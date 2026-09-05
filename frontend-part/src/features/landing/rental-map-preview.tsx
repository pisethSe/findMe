"use client";

import { useEffect, useRef, useState } from "react";

import { resolveGoogleMapsBrowserConfig } from "../../config/google-maps";
import { loadGoogleMaps } from "../../lib/maps/google-maps-loader";
import {
  map3DFallbackLabel,
  map3DFallbackMessage,
} from "../../lib/maps/map-3d-capability";
import {
  AVAILABLE_3D_GLYPH_SRC,
  UNAVAILABLE_3D_GLYPH_SRC,
} from "../../lib/maps/map-3d-scene";
import { useMap3DCapability } from "../../lib/maps/use-map-3d-capability";
import { createMap3DSession } from "../../lib/maps/map-3d-session";

type PreviewState = "fallback" | "waiting" | "loading" | "ready" | "error";

interface PreviewRental {
  id: string;
  title: string;
  price: string;
  available: boolean;
  position: google.maps.LatLngAltitudeLiteral;
  fallbackPosition: { left: string; top: string };
}

const PREVIEW_CENTER = { lat: 11.5718, lng: 104.8948, altitude: 30 };
const RUPP_POSITION = { lat: 11.5684, lng: 104.8903, altitude: 12 };

const PREVIEW_RENTALS: readonly PreviewRental[] = [
  {
    id: "teuk-laak",
    title: "Student room in Teuk La'ak",
    price: "$70/month",
    available: true,
    position: { lat: 11.5706, lng: 104.8903, altitude: 12 },
    fallbackPosition: { left: "34%", top: "38%" },
  },
  {
    id: "techno",
    title: "Private room near Sala Techno",
    price: "$90/month",
    available: true,
    position: { lat: 11.573, lng: 104.899, altitude: 12 },
    fallbackPosition: { left: "67%", top: "31%" },
  },
  {
    id: "toul-kork",
    title: "Toul Kork room",
    price: "Unavailable",
    available: false,
    position: { lat: 11.579, lng: 104.896, altitude: 12 },
    fallbackPosition: { left: "58%", top: "67%" },
  },
] as const;

const googleMapsConfig = resolveGoogleMapsBrowserConfig({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
  mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
});

function StaticMapFallback() {
  return (
    <div className="map-fallback" aria-hidden="true">
      <svg className="map-streets" viewBox="0 0 720 640">
        <rect width="720" height="640" />
        <path d="M-30 440 C130 360 245 390 390 305 S625 165 760 185" />
        <path d="M155 -40 C185 125 225 235 330 330 S510 500 545 680" />
        <path d="M-20 145 C170 195 270 170 405 95 S620 70 755 20" />
        <path d="M425 -20 C390 125 400 240 495 360 S625 545 705 575" />
        <path d="M5 575 C180 525 305 535 465 490 S625 445 755 470" />
        <g className="map-blocks">
          <rect x="48" y="220" width="126" height="78" rx="8" />
          <rect x="258" y="44" width="110" height="86" rx="8" />
          <rect x="474" y="198" width="134" height="76" rx="8" />
          <rect x="85" y="455" width="112" height="76" rx="8" />
          <rect x="330" y="420" width="118" height="92" rx="8" />
        </g>
      </svg>
      <div className="institution-pin">
        <span aria-hidden="true">U</span>
        <span>RUPP</span>
      </div>
      {PREVIEW_RENTALS.map((rental) => (
        <div
          className={`fallback-pin ${rental.available ? "is-available" : "is-unavailable"}`}
          style={rental.fallbackPosition}
          key={rental.id}
        >
          <span className="fallback-pin-icon" aria-hidden="true" />
          <span>
            {rental.available ? `Available · ${rental.price}` : "Unavailable"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RentalMapPreview() {
  const previewRef = useRef<HTMLElement>(null);
  const liveMapRef = useRef<HTMLDivElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<PreviewState>("waiting");
  const [enteredViewport, setEnteredViewport] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const capability = useMap3DCapability(googleMapsConfig.status);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || enteredViewport) return;
    if (!("IntersectionObserver" in window)) {
      setEnteredViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setEnteredViewport(true);
        observer.disconnect();
      },
      { rootMargin: "180px" },
    );
    observer.observe(preview);
    return () => observer.disconnect();
  }, [enteredViewport]);

  useEffect(() => {
    const container = liveMapRef.current;
    if (!container || capability.status === "checking") return;
    if (capability.status === "fallback") {
      setState("fallback");
      container.replaceChildren();
      return;
    }
    if (!enteredViewport) {
      setState("waiting");
      return;
    }
    if (googleMapsConfig.status !== "READY") {
      setState("fallback");
      return;
    }

    const liveMapContainer = container;
    const mapsConfiguration = googleMapsConfig.config;
    let map: google.maps.maps3d.Map3DElement | null = null;
    let animationFrame: number | null = null;
    let userInteracted = false;
    let revealScene: (() => void) | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    const session = createMap3DSession({
      onReady: () => revealScene?.(),
      onUnavailable: () => {
        const mapHadFocus = liveMapContainer.contains(document.activeElement);
        setState("error");
        if (mapHadFocus) {
          animationFrame = window.requestAnimationFrame(() =>
            retryButtonRef.current?.focus(),
          );
        }
      },
    });
    setState("loading");

    async function initializeMap() {
      try {
        await loadGoogleMaps(mapsConfiguration);
        if (!session.isActive()) return;
        const [{ Map3DElement, Marker3DElement }, { PinElement }] =
          await Promise.all([
            google.maps.importLibrary("maps3d"),
            google.maps.importLibrary("marker"),
          ]);
        if (!session.isActive()) return;

        map = new Map3DElement({
          center: PREVIEW_CENTER,
          bounds: {
            north: 11.591,
            south: 11.554,
            east: 104.914,
            west: 104.876,
          },
          range: 2_400,
          tilt: 58,
          heading: 24,
          fov: 42,
          mode: "HYBRID",
          gestureHandling: "COOPERATIVE",
          defaultUIHidden: true,
          description:
            "Three-dimensional rental demonstration near Royal University of Phnom Penh.",
          mapId: mapsConfiguration.mapId,
        });
        map.className = "live-map-element";

        const stopAnimation = () => {
          userInteracted = true;
          map?.stopCameraAnimation();
        };
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
        if ("IntersectionObserver" in window) {
          visibilityObserver = new IntersectionObserver(([entry]) => {
            if (!entry?.isIntersecting) stopAnimation();
          });
          visibilityObserver.observe(liveMapContainer);
        }

        revealScene = () => {
          if (!map) return;

          const institutionPin = new PinElement({
            background: "oklch(0.24 0.035 118)",
            borderColor: "oklch(1 0 0)",
            glyphColor: "oklch(1 0 0)",
            glyphText: "U",
            scale: 1.1,
          });
          const institutionMarker = new Marker3DElement({
            position: RUPP_POSITION,
            label: "Royal University of Phnom Penh",
            sizePreserved: true,
            zIndex: 20,
          });
          institutionMarker.append(institutionPin);
          map.append(institutionMarker);

          PREVIEW_RENTALS.forEach((rental, index) => {
            if (!map) return;
            const label = rental.available
              ? `Available, ${rental.price}. ${rental.title}`
              : `Unavailable. ${rental.title}`;
            const pin = new PinElement({
              background: rental.available
                ? "oklch(0.48 0.13 142)"
                : "oklch(0.48 0.18 28)",
              borderColor: "oklch(1 0 0)",
              glyphSrc: rental.available
                ? AVAILABLE_3D_GLYPH_SRC
                : UNAVAILABLE_3D_GLYPH_SRC,
              scale: 1.2,
            });
            const marker = new Marker3DElement({
              position: rental.position,
              label,
              collisionBehavior: "REQUIRED",
              collisionPriority: rental.available ? 12 : 8,
              drawsWhenOccluded: true,
              sizePreserved: true,
            });
            marker.className = "preview-3d-pin";
            marker.style.setProperty("--pin-delay", `${index * 70}ms`);
            marker.append(pin);
            map.append(marker);
          });

          setState("ready");
          animationFrame = window.requestAnimationFrame(() => {
            if (
              !session.isActive() ||
              !map ||
              userInteracted ||
              document.hidden
            )
              return;
            try {
              map.flyCameraTo({
                endCamera: {
                  center: { lat: 11.573, lng: 104.8955, altitude: 30 },
                  range: 2_250,
                  tilt: 60,
                  heading: 34,
                },
                durationMillis: 1_800,
              });
            } catch {
              session.fail();
            }
          });
        };
        session.attach(map);
        liveMapContainer.replaceChildren(map);
      } catch {
        session.fail();
      }
    }

    void initializeMap();
    return () => {
      if (liveMapContainer.contains(document.activeElement)) {
        previewRef.current?.focus({ preventScroll: true });
      }
      visibilityObserver?.disconnect();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      session.dispose();
      liveMapContainer.replaceChildren();
    };
  }, [capability.status, enteredViewport, loadAttempt]);

  const modeLabel =
    state === "ready"
      ? "3D map"
      : capability.status === "fallback"
        ? map3DFallbackLabel(capability.reason)
        : state === "loading"
          ? "Preparing 3D"
          : "2D preview";

  return (
    <section
      ref={previewRef}
      className="map-preview"
      tabIndex={-1}
      aria-labelledby="map-preview-title"
    >
      <div className="map-preview-heading">
        <div>
          <p id="map-preview-title">Rental preview near RUPP</p>
          <span>Demonstration locations, not live advertising</span>
        </div>
        <span className="preview-mode">{modeLabel}</span>
      </div>
      <div className="map-canvas">
        <StaticMapFallback />
        <div
          className={`live-map ${state === "ready" ? "is-ready" : ""}`}
          ref={liveMapRef}
          inert={state !== "ready"}
          aria-hidden={state !== "ready"}
        />
        {state === "loading" ? (
          <p className="map-status" role="status">
            Preparing the 3D map…
          </p>
        ) : state === "error" ? (
          <div className="map-status map-status-action">
            <span role="status">
              3D map unavailable. The 2D preview remains ready.
            </span>
            <button
              ref={retryButtonRef}
              type="button"
              onClick={() => setLoadAttempt((current) => current + 1)}
            >
              Try 3D again
            </button>
          </div>
        ) : capability.status === "fallback" &&
          capability.reason !== "MAPS_UNAVAILABLE" ? (
          <p className="map-status" role="status">
            {map3DFallbackMessage(capability.reason)}
          </p>
        ) : null}
      </div>
      <ul className="map-list" aria-label="Rentals shown in the preview">
        {PREVIEW_RENTALS.map((rental) => (
          <li key={rental.id}>
            <span
              className={`availability-symbol ${rental.available ? "is-available" : "is-unavailable"}`}
              aria-hidden="true"
            />
            <span>
              <strong>{rental.title}</strong>
              <small>
                {rental.available
                  ? `Available · ${rental.price}`
                  : "Unavailable"}
              </small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
