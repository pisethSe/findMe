import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { englishTitle, institution, rental, searchPage } from "./fixtures.ts";

const searchHref = `/search?institution=${institution.slug}`;
const viewports = [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 960, height: 800 },
  { width: 1440, height: 1000 },
];

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
}

async function capture(page: Page, name: string) {
  const directory = process.env.FINDME_QA_SCREENSHOTS;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: join(directory, `${name}.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  // An isolated image placeholder, never supplied to the production API.
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#dedfcf"/><text x="400" y="300" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#34362b">Test rental photo</text></svg>',
    }),
  );
});

for (const viewport of viewports) {
  test(`student discovery reflows at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(searchHref);
    await expect(
      page.getByRole("heading", { name: "2 rooms found" }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await noOverflow(page);
    await expect(
      page.getByRole("link", { name: "Saved rentals", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#rental-list")).toBeVisible();
    if (viewport.width <= 960) {
      await expect(page.locator("#rental-map")).toBeHidden();
      const trigger = page.getByRole("button", {
        name: "Filters",
        exact: true,
      });
      await expect(trigger).toBeVisible();
      expect((await trigger.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await capture(page, `search-${viewport.width}`);
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Search filters" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel("Maximum rent (USD)")).toHaveValue("300");
      expect(
        await dialog
          .getByLabel("Maximum rent (USD)")
          .evaluate((input) => parseFloat(getComputedStyle(input).fontSize)),
      ).toBeGreaterThanOrEqual(16);
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
      await capture(page, `filters-${viewport.width}`);
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(trigger).toBeFocused();
      await page.getByRole("button", { name: "Map", exact: true }).click();
      await expect(page.locator("#rental-list")).toBeHidden();
      await expect(
        page.getByText("Map preview is off.", { exact: false }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Back to rental list" }).click();
      await expect(page.locator("#rental-list")).toBeFocused();
      await expect(page.locator("#rental-list")).toBeVisible();
    } else {
      await expect(page.locator("#rental-map")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Filters", exact: true }),
      ).toBeHidden();
      await expect(page.getByLabel("Maximum rent (USD)")).toBeVisible();
      await capture(page, `search-${viewport.width}`);
    }

    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Find nearby rooms" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("heading", {
        name: "ស្វែងរកបន្ទប់ជួលដែលអ្នកពេញចិត្ត​ និងនៅជិតអ្នកបំផុត.",
      }),
    ).toBeVisible();
    await noOverflow(page);
    if (viewport.width <= 960) {
      const action = await page
        .getByRole("button", { name: "Find nearby rooms" })
        .boundingBox();
      const map = await page.locator(".map-preview").boundingBox();
      expect(action?.y).toBeLessThan(map?.y ?? 0);
    }
    await capture(page, `landing-${viewport.width}`);

    await page.goto(`/rentals/${rental.slug}?institution=${institution.slug}`);
    await expect(
      page.getByRole("heading", { name: englishTitle, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Call/ })).toBeVisible();
    await noOverflow(page);
    await page.getByRole("button", { name: "Next photo" }).click();
    await expect(page.getByText("Photo 2 of 2")).toBeVisible();
    await capture(page, `detail-${viewport.width}`);
  });
}

test("compact filter dialog contains focus, cancels drafts, validates, and applies URL filters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `${searchHref}&page=2&north=11.7&south=11.4&east=105&west=104.7`,
  );
  await expect(page.locator("#rental-list")).toBeVisible();
  const trigger = page.getByRole("button", { name: "Filters", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Search filters" });
  await expect(dialog.getByRole("heading")).toBeFocused();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await dialog.getByLabel("Maximum rent (USD)").fill("150");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByLabel("Maximum rent (USD)")).toHaveValue("300");
  await dialog.getByLabel("Maximum distance (km)").fill("0");
  await dialog.getByRole("button", { name: "Update results" }).click();
  await expect(dialog.getByLabel("Maximum distance (km)")).toBeFocused();
  await expect(dialog.getByRole("alert")).toContainText("Enter a distance");
  await capture(page, "invalid-distance");
  await dialog.getByLabel("Maximum distance (km)").fill("1.001");
  await dialog.getByLabel("Maximum rent (USD)").fill("150");
  await dialog.getByLabel("Rental type").selectOption("STUDIO");
  await dialog.getByRole("button", { name: "Update results" }).click();
  await expect(page).toHaveURL(/maxDistanceKm=1.001/);
  const params = new URL(page.url()).searchParams;
  expect(params.get("institution")).toBe(institution.slug);
  expect(params.get("maxRentUsd")).toBe("150");
  expect(params.get("propertyType")).toBe("STUDIO");
  for (const key of ["page", "north", "south", "east", "west"])
    expect(params.has(key)).toBe(false);
  await trigger.click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Maximum rent (USD)")).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});

test("search loading, empty, API failure and card-to-map focus remain usable on phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/listings/search?**", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(searchHref);
  await expect(
    page.getByText("Loading current published rentals…"),
  ).toBeVisible();
  await expect(page.locator(".loading-map")).toBeHidden();
  await noOverflow(page);
  await capture(page, "search-loading");
  release?.();
  await expect(page.locator("#rental-list")).toBeVisible();
  await page
    .getByRole("button", { name: "Show on map", exact: true })
    .first()
    .click();
  await expect(page.locator("#rental-map")).toBeFocused();
  await capture(page, "map-fallback");
  await page.getByRole("button", { name: "Back to rental list" }).click();
  await expect(page.locator("#rental-list")).toBeFocused();

  await page.goto(`${searchHref}&maxRentUsd=1`);
  await expect(
    page.getByRole("heading", {
      name: "No published rentals match these filters.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Widen search/ }),
  ).toBeVisible();
  await noOverflow(page);
  await capture(page, "search-empty");
  await page.goto(`${searchHref}&maxRentUsd=2`);
  await expect(
    page.getByRole("heading", { name: "Rentals unavailable" }),
  ).toBeVisible();
  await noOverflow(page);
  await capture(page, "search-error");
  await page.unroute("**/api/v1/listings/search?**");
  await page.route("**/api/v1/listings/search?**", (route) =>
    route.fulfill({
      json: searchPage(new URL(route.request().url()).searchParams),
    }),
  );
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("#rental-list")).toBeVisible();

  await page.goto("/rentals/unavailable-room");
  await expect(
    page.getByRole("heading", { name: /unavailable/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Call/ })).toHaveCount(0);
  await noOverflow(page);
  await capture(page, "detail-unavailable");
});

test("keyboard institution selection scrolls the option list", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(searchHref);
  await expect(page.locator("#rental-list")).toBeVisible();
  await page.route("**/api/v1/institutions?**", (route) =>
    route.fulfill({
      json: {
        data: Array.from({ length: 12 }, (_, index) => ({
          ...institution,
          id: `a77388a1-a003-4c84-9ce9-cc2eaf801d${String(index).padStart(2, "0")}`,
          slug: `school-${index}`,
          nameEn: `Institution ${index + 1}`,
        })),
        meta: { count: 12, limit: 12, query: "school", selectedSlug: null },
      },
    }),
  );
  const picker = page.getByRole("combobox", {
    name: "Institution",
    exact: true,
  });
  await picker.fill("school");
  await expect(page.getByRole("option")).toHaveCount(12);
  for (let i = 0; i < 12; i++) await picker.press("ArrowDown");
  const last = page.getByRole("option").last();
  await expect(last).toHaveAttribute("aria-selected", "true");
  const option = await last.boundingBox();
  const list = await page.getByRole("listbox").boundingBox();
  expect(option?.y).toBeGreaterThanOrEqual((list?.y ?? 0) - 1);
  expect((option?.y ?? 0) + (option?.height ?? 0)).toBeLessThanOrEqual(
    (list?.y ?? 0) + (list?.height ?? 0) + 1,
  );
  await picker.press("Escape");
  await expect(page.getByRole("listbox")).toBeHidden();
});
