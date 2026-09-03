"use client";

import { useEffect, useRef, useState } from "react";

type PreviewState = "fallback" | "loading" | "ready" | "error";

interface PreviewRental {
  id: string;
  title: string;
  price: string;
  available: boolean;
  position: google.maps.LatLngAltitudeLiteral;
  fallbackPosition: { left: string; top: string };
}

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

let mapsLoader: Promise<void> | undefined;

function loadGoogleMaps(apiKey: string): Promise<void> {
  const googleWindow = window as typeof window & {
    google?: typeof google;
  };
  if (googleWindow.google?.maps) return Promise.resolve();
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise<void>((resolve, reject) => {
    const callbackName = `__findMeMapsReady${Date.now()}`;
    const callbackHost = window as typeof window & Record<string, unknown>;
    const script = document.createElement("script");

    callbackHost[callbackName] = () => {
      delete callbackHost[callbackName];
      resolve();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      delete callbackHost[callbackName];
      mapsLoader = undefined;
      reject(new Error("Google Maps could not load."));
    };
    document.head.append(script);
  });

  return mapsLoader;
}

function StaticMapFallback() {
  return (
    <div className="map-fallback" aria-hidden="true">
      <svg
        className="map-streets"
        viewBox="0 0 720 640"
        role="img"
        aria-label="Simplified street map near Royal University of Phnom Penh"
      >
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
          <span className="fallback-pin-icon" aria-hidden="true">
            {rental.available ? "✓" : "×"}
          </span>
          <span>
            {rental.available ? `Available · ${rental.price}` : "Unavailable"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RentalMapPreview() {
  const liveMapRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PreviewState>("fallback");
  const [motionAllowed, setMotionAllowed] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => setMotionAllowed(!query.matches);

    applyPreference();
    query.addEventListener("change", applyPreference);
    return () => query.removeEventListener("change", applyPreference);
  }, []);

  useEffect(() => {
    const container = liveMapRef.current;

    if (!container || !apiKey || !motionAllowed) {
      setState("fallback");
      return;
    }

    const mapContainer = container;
    const mapsApiKey = apiKey;
    let active = true;
    setState("loading");

    async function initializeMap() {
      try {
        await loadGoogleMaps(mapsApiKey);
        const [{ Map3DElement, Marker3DInteractiveElement }, { PinElement }] =
          await Promise.all([
            google.maps.importLibrary("maps3d"),
            google.maps.importLibrary("marker"),
          ]);

        if (!active) return;

        const map = new Map3DElement({
          center: { lat: 11.5718, lng: 104.8948, altitude: 30 },
          range: 2_400,
          tilt: 58,
          heading: 24,
          mode: "HYBRID",
          gestureHandling: "COOPERATIVE",
        });
        map.className = "live-map-element";

        for (const rental of PREVIEW_RENTALS) {
          const label = rental.available
            ? `Available, ${rental.price}. ${rental.title}`
            : `Unavailable. ${rental.title}`;
          const pin = new PinElement({
            background: rental.available
              ? "oklch(0.48 0.13 142)"
              : "oklch(0.48 0.18 28)",
            borderColor: "oklch(1 0 0)",
            glyphColor: "oklch(1 0 0)",
            glyphText: rental.available ? "✓" : "×",
            scale: 1.2,
          });
          const marker = new Marker3DInteractiveElement({
            position: rental.position,
            title: label,
            label,
          });
          marker.append(pin);
          map.append(marker);
        }

        mapContainer.replaceChildren(map);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    }

    void initializeMap();

    return () => {
      active = false;
      mapContainer.replaceChildren();
    };
  }, [apiKey, motionAllowed]);

  return (
    <section className="map-preview" aria-labelledby="map-preview-title">
      <div className="map-preview-heading">
        <div>
          <p id="map-preview-title">Rental preview near RUPP</p>
          <span>Demonstration locations, not live advertising</span>
        </div>
        <span className="preview-mode">
          {state === "ready" ? "3D map" : "2D preview"}
        </span>
      </div>
      <div className="map-canvas">
        <StaticMapFallback />
        <div
          className={`live-map ${state === "ready" ? "is-ready" : ""}`}
          ref={liveMapRef}
          aria-hidden={state !== "ready"}
        />
        {state === "loading" ? (
          <p className="map-status" role="status">
            Loading the 3D map…
          </p>
        ) : null}
        {state === "error" ? (
          <p className="map-status" role="status">
            3D map unavailable. Showing the 2D rental preview.
          </p>
        ) : null}
      </div>
      <ul className="map-list" aria-label="Rentals shown in the preview">
        {PREVIEW_RENTALS.map((rental) => (
          <li key={rental.id}>
            <span
              className={`availability-symbol ${rental.available ? "is-available" : "is-unavailable"}`}
              aria-hidden="true"
            >
              {rental.available ? "✓" : "×"}
            </span>
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
