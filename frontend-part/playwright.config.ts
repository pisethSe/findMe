import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node tests/browser/fixture-server.ts",
      url: "http://127.0.0.1:3102/health",
      reuseExistingServer: false,
    },
    {
      command:
        "corepack pnpm --filter @findme/contracts build && corepack pnpm exec next dev --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        APP_ENV: "test",
        API_INTERNAL_BASE_URL: "http://127.0.0.1:3102/api/v1",
        NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:3102/api/v1",
        NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: "",
        NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: "",
        CDN_BASE_URL: "https://images.example.test",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
