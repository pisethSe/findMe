import type { NextConfig } from "next";
import path from "node:path";

import { validateGoogleMapsBuildEnvironment } from "./src/config/google-maps";
import { getListingImageRemotePatterns } from "./src/config/listing-images";
import {
  getSecurityHeaders,
  validateSecurityHeadersBuildEnvironment,
} from "./src/config/security-headers";

validateGoogleMapsBuildEnvironment({
  APP_ENV: process.env.APP_ENV,
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY:
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
});

// The CSP is baked into the build output, so a misclassified build would ship
// a weaker policy. Reject it here rather than at request time.
validateSecurityHeadersBuildEnvironment({ APP_ENV: process.env.APP_ENV });

const listingImageRemotePatterns = getListingImageRemotePatterns({
  APP_ENV: process.env.APP_ENV,
  CDN_BASE_URL: process.env.CDN_BASE_URL,
});

const nextConfig: NextConfig = {
  transpilePackages: ["@designcodeio/threeui"],
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  poweredByHeader: false,
  images: {
    remotePatterns: listingImageRemotePatterns,
    maximumRedirects: 0,
  },
  // Applied to every response, including the pages that render student
  // listings. The API origin is separate; these protect the web document.
  async headers() {
    const securityHeaders = getSecurityHeaders({
      APP_ENV: process.env.APP_ENV,
      CDN_BASE_URL: process.env.CDN_BASE_URL,
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    });
    return [
      {
        source: "/:path*",
        headers: securityHeaders.map(([name, value]) => ({ key: name, value })),
      },
    ];
  },
};

export default nextConfig;
