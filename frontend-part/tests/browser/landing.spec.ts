import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { khmerTitle } from "./fixtures.ts";

const widths = [320, 390, 768, 1440];
for (const width of widths) {
  test(`rentMe landing stays usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Search", exact: true }),
    ).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      await page
        .locator("header")
        .evaluate((el) => el.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(66);
    expect(await page.locator("[data-theme]").getAttribute("data-theme")).toBe(
      "light",
    );
    await expect(page.locator('img[src*="rentme-house"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "និងនៅជិតសាលាអ្នកបំផុត",
    );
    await expect(page.locator("canvas")).toHaveCount(0);
    if (width <= 820) {
      await page.getByRole("button", { name: "Toggle navigation" }).click();
      await expect(
        page.getByRole("link", { name: "About us", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "About us", exact: true })
        .press("Escape");
      await expect(
        page.getByRole("button", { name: "Toggle navigation" }),
      ).toBeFocused();
    }
    const output = process.env.FINDME_QA_SCREENSHOTS;
    if (output) {
      await mkdir(output, { recursive: true });
      await page.screenshot({
        path: join(
          output,
          width === 1440
            ? "desktop.png"
            : width === 390
              ? "mobile.png"
              : `landing-${width}.png`,
        ),
        fullPage: true,
      });
    }
  });
}

test("landing search applies campus, distance, budget and room type to live results and full search", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Search", exact: true }),
  ).toBeEnabled();
  const trigger = page.getByRole("button", { name: /More filters/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Find your kind of room" });
  await dialog.getByLabel("Maximum monthly rent (USD)").fill("125");
  await dialog.getByLabel("Rental type").selectOption("STUDIO");
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await dialog.getByRole("button", { name: "Apply filters" }).click();
  await expect(trigger).toBeFocused();
  await page
    .getByRole("combobox", { name: "Distance from campus" })
    .selectOption("2000");
  const requested = page.waitForRequest((request) =>
    request.url().includes("/listings/search?"),
  );
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const params = new URL((await requested).url()).searchParams;
  expect(params.get("radiusMeters")).toBe("2000");
  expect(params.get("maxPrice")).toBe("125");
  expect(params.get("propertyType")).toBe("STUDIO");
  await expect(
    page.getByRole("list", { name: "Current rental results" }),
  ).toBeVisible();
  await expect(
    page.getByText("2 available rooms · current listings"),
  ).toBeVisible();
  const full = page.getByRole("link", { name: "See all results & filters" });
  await expect(full).toHaveAttribute("href", /maxRentUsd=125/);
  await expect(full).toHaveAttribute("href", /propertyType=STUDIO/);
  await page
    .getByRole("list", { name: "Current rental results" })
    .getByRole("button")
    .last()
    .click();
  await expect(
    page
      .getByRole("complementary", { name: "Selected rental" })
      .getByRole("heading"),
  ).toHaveText(khmerTitle);
});

test("empty search explains recovery, and a failed search can retry without demo results", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Search", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /More filters/ }).click();
  await page.getByLabel("Maximum monthly rent (USD)").fill("1");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText(
      "No rooms match yet. Try a wider radius or a higher budget.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /A quiet room in Teuk/ }),
  ).toHaveCount(0);
  let fail = true;
  await page.route("**/listings/search?**", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { error: { code: "TEMPORARY_UNAVAILABLE" } },
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Broaden search" }).click();
  await expect(
    page.getByText("Rooms could not load. Please try again."),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry search" }).click();
  await expect(
    page.getByRole("list", { name: "Current rental results" }),
  ).toBeVisible();
});

test("university directory searches English, Khmer and provincial campuses; preferences and samples remain usable", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Browse university directory" })
    .click();
  const query = page.getByRole("searchbox", {
    name: "University name or city",
  });
  await query.fill("Kirirom");
  await expect(
    page.getByText("1 institutions found", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Kirirom Institute of Technology", { exact: true }),
  ).toBeVisible();
  await query.fill("វិទ្យាស្ថាន");
  await expect(
    page.getByText("Institute of Technology of Cambodia", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to Khmer" }).click();
  await expect(
    page.getByRole("searchbox", { name: "ឈ្មោះសាកលវិទ្យាល័យ ឬទីក្រុង" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ប្ដូរទៅពណ៌ងងឹត" }).click();
  await expect(page.locator("[data-theme]")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Switch to English" }),
  ).toBeVisible();
  await expect(page.locator("[data-theme]")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await page.goto("/login");
  await expect(page.getByLabel("អាសយដ្ឋានអ៊ីមែល")).toBeVisible();
  await expect(page.getByLabel("ពាក្យសម្ងាត់", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("exact ribbon starts in either theme, ends its introduction and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".ribbon-field canvas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause animation" }),
  ).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0, { timeout: 8000 });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator(".ribbon-field canvas")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("map modes change the real campus embed and the navigation supports hover", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByText("Location", { exact: true }).first().hover();
  await expect(
    page.getByRole("button", { name: "All Cambodian universities" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Satellite", exact: true }).click();
  await expect(
    page.locator('iframe[title="Google Maps campus preview"]'),
  ).toHaveAttribute("src", /t=k/);
  await page.getByRole("button", { name: "2D map", exact: true }).click();
  await expect(
    page.locator('iframe[title="Google Maps campus preview"]'),
  ).toHaveAttribute("src", /t=m/);
  await page.getByRole("button", { name: "Default map", exact: true }).click();
  await expect(
    page.locator('iframe[title="Google Maps campus preview"]'),
  ).toHaveAttribute("src", /t=p/);
});
