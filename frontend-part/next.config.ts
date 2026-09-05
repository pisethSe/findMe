import type { NextConfig } from "next";
import path from "node:path";

import { validateGoogleMapsBuildEnvironment } from "./src/config/google-maps";
import { getListingImageRemotePatterns } from "./src/config/listing-images";

validateGoogleMapsBuildEnvironment({
  APP_ENV: process.env.APP_ENV,
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY:
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
});

const listingImageRemotePatterns = getListingImageRemotePatterns({
  APP_ENV: process.env.APP_ENV,
  CDN_BASE_URL: process.env.CDN_BASE_URL,
});

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  poweredByHeader: false,
  images: {
    remotePatterns: listingImageRemotePatterns,
    maximumRedirects: 0,
  },
};

export default nextConfig;
