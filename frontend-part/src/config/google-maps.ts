export interface GoogleMapsBrowserConfig {
  apiKey: string;
  mapId: string;
}

export type GoogleMapsBrowserConfigResult =
  | { status: "DISABLED" }
  | { status: "INVALID"; reason: string }
  | { status: "READY"; config: GoogleMapsBrowserConfig };

interface GoogleMapsBrowserEnvironment {
  APP_ENV?: string;
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?: string;
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?: string;
}

const PLACEHOLDER_PATTERN =
  /replace-with|change-before|your[-_ ]?(api[-_ ]?)?key|your[-_ ]?map[-_ ]?id/i;
const SAFE_CREDENTIAL_PATTERN = /^[A-Za-z0-9_-]+$/;

export function resolveGoogleMapsBrowserConfig(input: {
  apiKey: string | undefined;
  mapId: string | undefined;
}): GoogleMapsBrowserConfigResult {
  const apiKey = input.apiKey?.trim() ?? "";
  const mapId = input.mapId?.trim() ?? "";

  if (!apiKey && !mapId) return { status: "DISABLED" };
  if (!apiKey || !mapId) {
    return {
      status: "INVALID",
      reason:
        "The Google Maps browser key and map ID must be configured together.",
    };
  }
  if (!isSafeCredential(apiKey) || apiKey.length < 20) {
    return {
      status: "INVALID",
      reason:
        "The Google Maps browser key is malformed or still a placeholder.",
    };
  }
  if (!isSafeCredential(mapId) || mapId.length < 8) {
    return {
      status: "INVALID",
      reason: "The Google Maps map ID is malformed or still a placeholder.",
    };
  }

  return { status: "READY", config: { apiKey, mapId } };
}

export function validateGoogleMapsBuildEnvironment(
  environment: GoogleMapsBrowserEnvironment,
): GoogleMapsBrowserConfigResult {
  const result = resolveGoogleMapsBrowserConfig({
    apiKey: environment.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
    mapId: environment.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
  });
  const appEnvironment = environment.APP_ENV?.trim() || "local";

  if (
    ["staging", "production"].includes(appEnvironment) &&
    result.status !== "READY"
  ) {
    const detail =
      result.status === "INVALID"
        ? result.reason
        : "The Google Maps browser key and map ID are required.";
    throw new TypeError(
      `Google Maps build configuration is invalid. ${detail}`,
    );
  }

  return result;
}

function isSafeCredential(value: string): boolean {
  return (
    SAFE_CREDENTIAL_PATTERN.test(value) && !PLACEHOLDER_PATTERN.test(value)
  );
}
