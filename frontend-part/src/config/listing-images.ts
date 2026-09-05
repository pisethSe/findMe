interface ListingImageEnvironment {
  APP_ENV?: string;
  CDN_BASE_URL?: string;
}

export function getListingImageRemotePatterns(
  environment: ListingImageEnvironment,
): URL[] {
  const appEnvironment = environment.APP_ENV?.trim().toLowerCase() || "local";
  const rawBaseUrl = environment.CDN_BASE_URL?.trim();
  if (!rawBaseUrl) {
    if (["staging", "production"].includes(appEnvironment)) {
      throw new Error(
        "CDN_BASE_URL is required at frontend build time in staging and production.",
      );
    }
    return [];
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error("CDN_BASE_URL must be a valid absolute HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("CDN_BASE_URL must use HTTP or HTTPS.");
  }
  if (
    ["staging", "production"].includes(appEnvironment) &&
    baseUrl.protocol !== "https:"
  ) {
    throw new Error("CDN_BASE_URL must use HTTPS in staging and production.");
  }
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error(
      "CDN_BASE_URL cannot include credentials, a query string, or a fragment.",
    );
  }

  const pathPrefix = baseUrl.pathname.replace(/\/$/, "");
  baseUrl.pathname = `${pathPrefix}/**`;
  return [baseUrl];
}
