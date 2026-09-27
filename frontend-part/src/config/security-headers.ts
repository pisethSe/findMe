interface SecurityEnvironment {
  APP_ENV?: string;
  CDN_BASE_URL?: string;
  NEXT_PUBLIC_API_BASE_URL?: string;
}

/**
 * Origins the product genuinely needs at runtime.
 *
 * Google Maps is loaded as a script from `maps.googleapis.com` and draws tiles
 * and sprites from `maps.gstatic.com`. The landing fallback embeds the
 * Google-hosted campus map in an iframe, which is the only allowed frame.
 * Rental photos are served from the configured CDN and proxied by the Next.js
 * image optimizer. `next/font` self-hosts Kantumruy Pro, so no font CDN is
 * required.
 */
const GOOGLE_MAPS_SCRIPT_ORIGIN = "https://maps.googleapis.com";
const GOOGLE_MAPS_ASSET_ORIGIN = "https://maps.gstatic.com";
// The campus embed is requested from maps.google.com and redirects to
// www.google.com before rendering, so both hosts must be framable.
const GOOGLE_MAPS_EMBED_ORIGINS = [
  "https://maps.google.com",
  "https://www.google.com",
] as const;

function originOf(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function unique(values: readonly (string | null)[]): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function cspValue(
  directives: ReadonlyArray<readonly [string, readonly string[]]>,
) {
  return directives
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

/**
 * Build the Content Security Policy for the public web app.
 *
 * The policy is strict about the highest-risk directives (`object-src`,
 * `base-uri`, `frame-ancestors`, `form-action`) and allows only the
 * third-party origins the product actually uses.
 *
 * `'unsafe-inline'` is present for both scripts and styles because the Next.js
 * App Router inlines its flight payload and runtime bootstrap into the document,
 * and the WebGL landing ribbon adds further inline styles. Removing it requires
 * a per-request nonce, which the Next.js guide notes forces dynamic rendering;
 * the public landing page is intentionally static, so that trade-off is
 * documented rather than taken here. The directives that prevent framing,
 * plugin content, base-tag rewriting, and off-site form posting do not depend
 * on this allowance.
 *
 * `'unsafe-eval'` is granted only outside staging and production, because React
 * requires it to reconstruct server error stacks during development and never
 * uses it in a production build.
 */
export function getContentSecurityPolicy(
  environment: SecurityEnvironment,
): string {
  const appEnvironment = environment.APP_ENV?.trim().toLowerCase() || "local";
  // React uses eval() in development to reconstruct server error stacks, as the
  // Next.js CSP guide notes. A production build never needs it, so the
  // relaxation is limited to local and test environments.
  const isDeployed = ["staging", "production"].includes(appEnvironment);
  const cdnOrigin = originOf(environment.CDN_BASE_URL);
  const apiOrigin = originOf(environment.NEXT_PUBLIC_API_BASE_URL);

  return cspValue([
    ["default-src", ["'self'"]],
    [
      "script-src",
      unique([
        "'self'",
        "'unsafe-inline'",
        isDeployed ? null : "'unsafe-eval'",
        GOOGLE_MAPS_SCRIPT_ORIGIN,
      ]),
    ],
    [
      "style-src",
      unique(["'self'", "'unsafe-inline'", GOOGLE_MAPS_SCRIPT_ORIGIN]),
    ],
    [
      "img-src",
      unique([
        "'self'",
        "data:",
        "blob:",
        GOOGLE_MAPS_ASSET_ORIGIN,
        ...GOOGLE_MAPS_EMBED_ORIGINS,
        cdnOrigin,
      ]),
    ],
    ["font-src", unique(["'self'", "data:", cdnOrigin])],
    [
      "connect-src",
      unique([
        "'self'",
        apiOrigin,
        GOOGLE_MAPS_SCRIPT_ORIGIN,
        GOOGLE_MAPS_ASSET_ORIGIN,
      ]),
    ],
    // The WebGL ribbon and the 3D map render into a local canvas.
    ["worker-src", unique(["'self'", "blob:"])],
    // Only the Google-hosted campus map may be embedded.
    ["frame-src", GOOGLE_MAPS_EMBED_ORIGINS],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ]);
}

/**
 * Response headers applied to every public page. These complement the CSP
 * rather than duplicate it: the policy governs which resources a page may load,
 * while these govern how the browser handles the response itself.
 */
/**
 * Build-time guard for the environment classification that drives CSP.
 *
 * The Content Security Policy is written into the build output by
 * `next.config.ts`, so it is fixed when the application is built and cannot be
 * changed by the environment that later runs it. Every deployed build path sets
 * `APP_ENV` explicitly (CI and `deploy-part/docker/frontend.Dockerfile`), so a
 * build that sets it to something unrecognised would bake the development
 * policy, granting `'unsafe-eval'` and omitting HSTS, silently.
 *
 * A build with no `APP_ENV` at all is the documented local `pnpm run build`,
 * which keeps the development policy and is not rejected here.
 */
export function validateSecurityHeadersBuildEnvironment(environment: {
  APP_ENV?: string | undefined;
}): void {
  const appEnvironment = environment.APP_ENV?.trim();
  // Unset means the documented local build, which intentionally uses the
  // development policy.
  if (!appEnvironment) return;
  if (!["local", "test", "staging", "production"].includes(appEnvironment)) {
    throw new TypeError(
      "APP_ENV must be one of local, test, staging, or production.",
    );
  }
}

export function getSecurityHeaders(
  environment: SecurityEnvironment,
): ReadonlyArray<readonly [string, string]> {
  const appEnvironment = environment.APP_ENV?.trim().toLowerCase() || "local";
  const headers: Array<readonly [string, string]> = [
    ["Content-Security-Policy", getContentSecurityPolicy(environment)],
    // Stop browsers from guessing a response type or sniffing content.
    ["X-Content-Type-Options", "nosniff"],
    // Referrer URLs can leak private search context to Google and the CDN.
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    // Deny powerful browser features the product never uses.
    [
      "Permissions-Policy",
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    ],
    // The app must never be framed or embedded by another site.
    ["X-Frame-Options", "DENY"],
  ];

  if (["staging", "production"].includes(appEnvironment)) {
    headers.push([
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    ]);
  }

  return headers;
}
