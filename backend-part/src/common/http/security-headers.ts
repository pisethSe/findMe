import type { AppEnvironment } from "../../config/environment.js";

/**
 * Response headers applied to every NestJS API response.
 *
 * The API only ever returns JSON, so it does not need the web document's
 * Content Security Policy. These headers instead stop a browser from
 * misinterpreting an API response: no MIME sniffing, no framing, and no
 * referrer or browser-feature leakage. CORS already restricts which browser
 * origins may read authenticated responses.
 */
export function getApiSecurityHeaders(
  appEnvironment: AppEnvironment,
): ReadonlyArray<readonly [string, string]> {
  const headers: Array<readonly [string, string]> = [
    ["X-Content-Type-Options", "nosniff"],
    // An API response is never a page, so it must never be framed.
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "no-referrer"],
    [
      "Permissions-Policy",
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    ],
    // The API returns JSON and must never be treated as an executable document.
    [
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; sandbox",
    ],
  ];

  if (["staging", "production"].includes(appEnvironment)) {
    headers.push([
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    ]);
  }

  return headers;
}
