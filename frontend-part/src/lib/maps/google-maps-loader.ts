import type { GoogleMapsBrowserConfig } from "../../config/google-maps";

let mapsLoader: Promise<void> | undefined;
const GOOGLE_MAPS_LOAD_TIMEOUT_MS = 12_000;

export function loadGoogleMaps(config: GoogleMapsBrowserConfig): Promise<void> {
  const googleWindow = window as typeof window & { google?: typeof google };
  if (googleWindow.google?.maps) return Promise.resolve();
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise<void>((resolve, reject) => {
    const callbackName = `__findMeMapsReady${Date.now()}`;
    const callbackHost = window as typeof window & Record<string, unknown>;
    const script = document.createElement("script");
    const source = new URL("https://maps.googleapis.com/maps/api/js");
    source.search = new URLSearchParams({
      key: config.apiKey,
      v: "weekly",
      loading: "async",
      callback: callbackName,
      auth_referrer_policy: "origin",
      language: "km",
      region: "KH",
      map_ids: config.mapId,
    }).toString();
    const timeout = window.setTimeout(() => {
      delete callbackHost[callbackName];
      script.remove();
      mapsLoader = undefined;
      reject(new Error("Google Maps took too long to load."));
    }, GOOGLE_MAPS_LOAD_TIMEOUT_MS);

    callbackHost[callbackName] = () => {
      window.clearTimeout(timeout);
      delete callbackHost[callbackName];
      resolve();
    };
    script.src = source.toString();
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      delete callbackHost[callbackName];
      mapsLoader = undefined;
      reject(new Error("Google Maps could not load."));
    };
    document.head.append(script);
  });

  return mapsLoader;
}
