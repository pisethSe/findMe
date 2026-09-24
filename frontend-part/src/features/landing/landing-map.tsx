"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { InstitutionDto, PublicListingDto } from "@findme/contracts";
import { resolveGoogleMapsBrowserConfig } from "../../config/google-maps";
import { loadGoogleMaps } from "../../lib/maps/google-maps-loader";
import {
  LandingIcon,
  type LandingLocale,
  translate as t,
} from "./landing-icons";
import styles from "./rentme.module.css";

export interface MapRoom {
  id: string;
  title: string;
  price: string;
  available: boolean;
  image: string | null;
  lat: number;
  lng: number;
  distance: string;
  href: string;
  sample: boolean;
}
export const SAMPLE_MAP_ROOMS: readonly MapRoom[] = [
  {
    id: "sample-1",
    title: "A quiet room in Teuk La'ak",
    price: "$90",
    available: true,
    image: "/images/landing/student-room.png",
    lat: 11.5706,
    lng: 104.8903,
    distance: "0.8 km from RUPP",
    href: "/search?institution=royal-university-of-phnom-penh",
    sample: true,
  },
  {
    id: "sample-2",
    title: "A little more space to settle in",
    price: "$150",
    available: true,
    image: "/images/landing/studio-room.png",
    lat: 11.573,
    lng: 104.899,
    distance: "1.4 km from RUPP",
    href: "/search?institution=royal-university-of-phnom-penh",
    sample: true,
  },
  {
    id: "sample-3",
    title: "A shared student apartment",
    price: "$120",
    available: false,
    image: "/images/landing/shared-room.png",
    lat: 11.579,
    lng: 104.896,
    distance: "2.1 km from RUPP",
    href: "/search?institution=royal-university-of-phnom-penh",
    sample: true,
  },
];
export function listingToMapRoom(
  listing: PublicListingDto,
  institution: InstitutionDto,
  locale: LandingLocale,
): MapRoom {
  return {
    id: listing.id,
    title:
      (locale === "km"
        ? (listing.titleKm ?? listing.titleEn)
        : (listing.titleEn ?? listing.titleKm)) ??
      t(locale, "Student room", "បន្ទប់សិស្ស"),
    price: new Intl.NumberFormat(locale === "km" ? "km-KH" : "en-US", {
      style: "currency",
      currency: listing.currency,
      maximumFractionDigits: 0,
    }).format(listing.monthlyPrice),
    available: listing.availableUnits > 0,
    image: listing.primaryImage?.publicUrl ?? null,
    lat: listing.location.latitude,
    lng: listing.location.longitude,
    distance: `${(listing.distanceMeters / 1000).toFixed(1)} km ${t(locale, "from", "ពី")} ${institution.shortName ?? institution.nameEn}`,
    href: `/rentals/${encodeURIComponent(listing.slug)}?institution=${encodeURIComponent(institution.slug)}`,
    sample: false,
  };
}
const config = resolveGoogleMapsBrowserConfig({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
  mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
});
type MapMode = "default" | "satellite" | "2d";

export function LandingMap({
  rooms,
  institution,
  locale,
  selectedId,
  onSelect,
}: {
  rooms: readonly MapRoom[];
  institution: InstitutionDto | null;
  locale: LandingLocale;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<
    {
      marker: google.maps.marker.AdvancedMarkerElement;
      button: HTMLButtonElement;
      id: string;
    }[]
  >([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [status, setStatus] = useState<
    "loading" | "ready" | "fallback" | "error"
  >(config.status === "READY" ? "loading" : "fallback");
  const [mode, setMode] = useState<MapMode>("default");
  const [embedFailed, setEmbedFailed] = useState(false);
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [photoFailed, setPhotoFailed] = useState<string | null>(null);
  const selected = rooms.find((room) => room.id === selectedId) ?? rooms[0];
  const isDemo = rooms.some((room) => room.sample);
  const embedSrc = `https://maps.google.com/maps?${new URLSearchParams({
    q:
      selected && !selected.sample
        ? `${selected.lat},${selected.lng}`
        : institution
          ? `${institution.latitude},${institution.longitude}`
          : "Royal University of Phnom Penh Cambodia",
    t: mode === "satellite" ? "k" : mode === "default" ? "p" : "m",
    z: "14",
    output: "embed",
    hl: locale,
  })}`;
  useEffect(() => {
    setEmbedLoaded(false);
    setEmbedFailed(false);
  }, [embedSrc, retry]);
  useEffect(() => {
    if (status === "ready" || embedLoaded) return;
    const timer = window.setTimeout(() => setEmbedFailed(true), 15000);
    return () => window.clearTimeout(timer);
  }, [status, embedLoaded, embedSrc, retry]);
  const sampleTitles: Record<string, string> = {
    "sample-1": "បន្ទប់ស្ងប់ស្ងាត់នៅទឹកល្អក់",
    "sample-2": "កន្លែងធំទូលាយសម្រាប់រស់នៅ",
    "sample-3": "អាផាតមិនរួមគ្នាសម្រាប់និស្សិត",
  };
  const selectedTitle =
    selected?.sample && locale === "km"
      ? (sampleTitles[selected.id] ?? selected.title)
      : selected?.title;
  const selectedDistance =
    selected?.sample && locale === "km"
      ? selected.distance.replace("km from", "គម ពី")
      : selected?.distance;

  useEffect(() => {
    if (config.status !== "READY" || !host.current) return;
    let disposed = false;
    const listeners: google.maps.MapsEventListener[] = [];
    const currentHost = host.current;
    setStatus("loading");
    const timeout = window.setTimeout(() => {
      if (!disposed) setStatus("error");
    }, 15_000);
    async function initialize() {
      if (config.status !== "READY") return;
      try {
        await loadGoogleMaps(config.config);
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
          google.maps.importLibrary("maps"),
          google.maps.importLibrary("marker"),
        ]);
        if (disposed) return;
        const center = {
          lat: institution?.latitude ?? 11.5684,
          lng: institution?.longitude ?? 104.8903,
        };
        const map = new Map(currentHost, {
          center,
          zoom: 14,
          mapId: config.config.mapId,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "cooperative",
          clickableIcons: false,
          tilt: 0,
        });
        mapRef.current = map;
        listeners.push(
          map.addListener("tilesloaded", () => {
            window.clearTimeout(timeout);
            if (!disposed) setStatus("ready");
          }),
        );
        const campus = document.createElement("span");
        campus.className = styles.campusMarker ?? "";
        campus.textContent = institution?.shortName ?? "RUPP";
        const campusMarker = new AdvancedMarkerElement({
          map,
          position: center,
          content: campus,
          title: institution?.nameEn ?? "Royal University of Phnom Penh",
        });
        const bounds = new google.maps.LatLngBounds(center);
        markersRef.current = rooms.map((room) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = styles.mapPin ?? "";
          button.dataset.available = String(room.available);
          button.textContent = `${room.price} · ${t(locale, room.available ? "Available" : "Unavailable", room.available ? "ទំនេរ" : "មិនទំនេរ")}`;
          button.setAttribute(
            "aria-label",
            `${room.title}, ${room.price}, ${room.distance}`,
          );
          button.addEventListener("pointerenter", () =>
            onSelectRef.current(room.id),
          );
          button.addEventListener("focus", () => onSelectRef.current(room.id));
          button.addEventListener("click", () => onSelectRef.current(room.id));
          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: room.lat, lng: room.lng },
            content: button,
            title: room.title,
          });
          bounds.extend({ lat: room.lat, lng: room.lng });
          return { marker, button, id: room.id };
        });
        if (rooms.length) map.fitBounds(bounds, 75);
        listeners.push({
          remove: () => {
            campusMarker.map = null;
          },
        });
      } catch {
        window.clearTimeout(timeout);
        if (!disposed) setStatus("error");
      }
    }
    void initialize();
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      listeners.forEach((listener) => listener.remove());
      markersRef.current.forEach(({ marker }) => {
        marker.map = null;
      });
      markersRef.current = [];
      mapRef.current = null;
      currentHost.replaceChildren();
    };
  }, [rooms, institution, locale, retry]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setMapTypeId(mode === "satellite" ? "hybrid" : "roadmap");
    map.setTilt(mode === "default" ? 45 : 0);
    map.setHeading(0);
  }, [mode, status]);
  useEffect(() => {
    markersRef.current.forEach(({ id, marker, button }) => {
      button.dataset.selected = String(id === selectedId);
      marker.zIndex = id === selectedId ? 10 : 1;
    });
  }, [selectedId, status]);
  const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(institution ? `${institution.latitude},${institution.longitude}` : "Royal University of Phnom Penh Cambodia")}`;
  return (
    <div className={styles.mapFrame}>
      <div className={styles.mapToolbar}>
        <div
          className={styles.mapModes}
          aria-label={t(locale, "Map type", "ប្រភេទផែនទី")}
        >
          {(["default", "satellite", "2d"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {value === "default"
                ? t(locale, "Default map", "ផែនទីធម្មតា")
                : value === "satellite"
                  ? t(locale, "Satellite", "ផ្កាយរណប")
                  : t(locale, "2D map", "ផែនទី 2D")}
            </button>
          ))}
        </div>
        <div className={styles.legend}>
          <span>
            <i />
            {t(locale, "Available", "ទំនេរ")}
          </span>
          <span>
            <i />
            {t(locale, "Unavailable", "មិនទំនេរ")}
          </span>
        </div>
      </div>
      {isDemo ? (
        <div
          className={styles.mapSampleSelector}
          aria-label={t(locale, "Sample room previews", "មើលបន្ទប់គំរូ")}
        >
          <span>
            {t(
              locale,
              "Sample rooms · illustrative prices",
              "បន្ទប់គំរូ · តម្លៃជាឧទាហរណ៍",
            )}
          </span>
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              aria-pressed={selected?.id === room.id}
              onPointerEnter={() => onSelect(room.id)}
              onFocus={() => onSelect(room.id)}
              onClick={() => onSelect(room.id)}
            >
              {room.price} ·{" "}
              {t(
                locale,
                room.available ? "Available" : "Unavailable",
                room.available ? "ទំនេរ" : "មិនទំនេរ",
              )}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.mapContent}>
        <div className={styles.mapStage}>
          <div
            className={styles.googleMap}
            ref={host}
            aria-label={t(locale, "Rental map", "ផែនទីបន្ទប់ជួល")}
            style={{ visibility: status === "ready" ? "visible" : "hidden" }}
          />
          {status !== "ready" && !embedFailed ? (
            <iframe
              key={`${mode}-${retry}`}
              className={styles.mapEmbed}
              title={t(
                locale,
                "Google Maps campus preview",
                "មើលទីតាំងសាលាលើ Google Maps",
              )}
              src={embedSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              onLoad={() => setEmbedLoaded(true)}
              onError={() => setEmbedFailed(true)}
            />
          ) : null}
          {status !== "ready" && (embedFailed || !embedLoaded) ? (
            <div className={styles.mapNotice} role="status">
              <span>
                {!embedFailed
                  ? t(locale, "Loading Google Maps…", "កំពុងផ្ទុក Google Maps…")
                  : t(
                      locale,
                      "The map could not load. You can still explore rooms below.",
                      "Google Maps មិនទាន់ភ្ជាប់។ អ្នកនៅតែអាចមើលបន្ទប់ខាងក្រោមបាន។",
                    )}
              </span>
              {embedFailed ? (
                <button
                  type="button"
                  onClick={() => {
                    setEmbedFailed(false);
                    setRetry((value) => value + 1);
                  }}
                >
                  {t(locale, "Retry map", "សាកល្បងម្ដងទៀត")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <aside
          className={styles.mapSelected}
          aria-label={t(locale, "Selected rental", "បន្ទប់ដែលបានជ្រើស")}
        >
          {selected ? (
            <>
              <div className={styles.selectedPhoto}>
                {selected.image && photoFailed !== selected.id ? (
                  <Image
                    src={selected.image}
                    alt={selectedTitle ?? selected.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 300px"
                    unoptimized={!selected.image.startsWith("/")}
                    onError={() => setPhotoFailed(selected.id)}
                  />
                ) : (
                  <span>
                    {t(locale, "Photo coming soon", "មិនទាន់មានរូបភាព")}
                  </span>
                )}
                <span className={styles.photoLabel}>
                  {selected.sample
                    ? t(locale, "Sample room", "បន្ទប់គំរូ")
                    : t(locale, "Current listing", "បញ្ជីបច្ចុប្បន្ន")}
                </span>
              </div>
              <div className={styles.selectedInfo}>
                <span
                  className={styles.availability}
                  data-available={selected.available}
                >
                  {selected.available ? (
                    <LandingIcon name="check" />
                  ) : (
                    <LandingIcon name="close" />
                  )}
                  {t(
                    locale,
                    selected.available ? "Available" : "Unavailable",
                    selected.available ? "ទំនេរ" : "មិនទំនេរ",
                  )}
                </span>
                <h3>{selectedTitle}</h3>
                <p>
                  <LandingIcon name="pin" />
                  {selectedDistance}
                </p>
                <div className={styles.selectedPrice}>
                  <strong>
                    {selected.price}
                    <small>/{t(locale, "month", "ខែ")}</small>
                  </strong>
                  <Link
                    href={selected.href}
                    aria-label={t(
                      locale,
                      selected.sample
                        ? "Find rooms like this"
                        : "View rental details",
                      selected.sample
                        ? "ស្វែងរកបន្ទប់ស្រដៀងនេះ"
                        : "មើលព័ត៌មានបន្ទប់",
                    )}
                  >
                    <LandingIcon name="arrow" />
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyMap}>
              <LandingIcon name="pin" />
              <h3>
                {t(
                  locale,
                  "Your next room starts here",
                  "ចាប់ផ្ដើមស្វែងរកបន្ទប់នៅទីនេះ",
                )}
              </h3>
              <p>
                {t(
                  locale,
                  "Choose a university and adjust your filters to see nearby rentals.",
                  "ជ្រើសរើសសាកលវិទ្យាល័យ និងកែតម្រង ដើម្បីមើលបន្ទប់នៅជិត។",
                )}
              </p>
            </div>
          )}
          <a
            className={styles.googleLink}
            href={googleUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t(
              locale,
              "View university on Google Maps",
              "មើលសាកលវិទ្យាល័យលើ Google Maps",
            )}
            <LandingIcon name="arrow" />
          </a>
        </aside>
      </div>
    </div>
  );
}
