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
    // The hero headline follows the locale toggle in both directions.
    const heroHeading = page.getByRole("heading", { level: 1 });
    await expect(heroHeading).toContainText("and near your school.");
    await expect(heroHeading).toHaveAttribute("lang", "en");
    await page.getByRole("button", { name: "Switch to Khmer" }).click();
    await expect(heroHeading).toHaveAttribute("lang", "km");
    await expect(heroHeading).toContainText("និងនៅជិតសាលាអ្នកបំផុត");
    await page.getByRole("button", { name: "Switch to English" }).click();
    await expect(heroHeading).toContainText("and near your school.");
    // These tests run under reduced motion, which skips every hero canvas.
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

test("campus field runs bilingual examples and accepts Khmer, English and any case", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const campus = page.getByRole("combobox", { name: "Your university" });
  const running = page.locator(".institution-picker-running");

  // Idle field: a Khmer line and an English line run with a slide transition.
  await expect(running).toBeVisible();
  await expect(running.locator('[lang="km"]')).not.toHaveText("");
  await expect(running.locator('[lang="en"]')).not.toHaveText("");
  await expect(running).toHaveAttribute("aria-hidden", "true");
  const firstExample = (await running.innerText()).trim();
  await expect
    .poll(async () => (await running.innerText()).trim(), { timeout: 9_000 })
    .not.toBe(firstExample);

  // Pressing the field hides the running text and leaves a clean input.
  await campus.click();
  await expect(running).toHaveCount(0);
  await expect(campus).toHaveAttribute(
    "placeholder",
    "Search in Khmer or English",
  );

  // English matches in upper and lower case, Khmer matches as typed.
  const results = page
    .getByRole("listbox", { name: "Active institutions" })
    .getByRole("option");
  await campus.fill("ROYAL");
  await expect(results).toHaveCount(1);
  await campus.fill("royal university");
  await expect(results).toHaveCount(1);
  await campus.fill("សាកលវិទ្យាល័យ");
  await expect(results).toHaveCount(1);
  await campus.fill("no campus matches this text");
  await expect(
    page.getByText(
      "No active institutions match this name. Try Khmer, English, or an abbreviation.",
    ),
  ).toBeVisible();

  // Both languages stay visible after the locale switches to Khmer.
  await campus.fill("");
  await campus.press("Tab");
  await page.getByRole("button", { name: "Switch to Khmer" }).click();
  await expect(running).toBeVisible();
  await expect(running.locator('[lang="km"]')).not.toHaveText("");
  await expect(running.locator('[lang="en"]')).not.toHaveText("");
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

test("ribbon plays over the dark hero only, ends its introduction and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  // Light appearance never mounts the ribbon: the day photograph keeps its own
  // sky, with the small cloud layer instead.
  const ribbon = page.locator(".shader-frame");
  await expect(ribbon).toBeHidden();
  await expect(ribbon).toHaveCSS("mix-blend-mode", "normal");
  await expect(ribbon).toHaveCSS("filter", "none");
  await expect(page.locator(".ribbon-field canvas")).toHaveCount(0);
  await expect(
    page
      .locator(
        'section[aria-labelledby="hero-title"] [aria-hidden="true"] span',
      )
      .first(),
  ).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(
    page.locator('section[aria-labelledby="hero-title"] > div').first(),
  ).toHaveCSS("filter", "none");
  await expect(
    page.getByRole("button", { name: "Pause animation" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator(".ribbon-field canvas")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("the light hero layers a small cloud shader over the top of the day photograph", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const hydration: string[] = [];
  page.on("console", (message) => {
    if (/hydrat/i.test(message.text())) hydration.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (/hydrat/i.test(error.message)) hydration.push(error.message);
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const layer = page.locator('[data-hero-layer="clouds"]');
  await expect(layer).toHaveCount(1);
  await expect(layer).toHaveAttribute("aria-hidden", "true");
  await expect(layer.locator("canvas")).toBeVisible();
  // One canvas at most: light mounts the clouds, not the ribbon.
  await expect(page.locator(".ribbon-field canvas")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(layer).toHaveCSS("pointer-events", "none");

  const heroBox = await page
    .locator('section[aria-labelledby="hero-title"]')
    .boundingBox();
  const layerBox = await layer.boundingBox();
  expect(heroBox).not.toBeNull();
  expect(layerBox).not.toBeNull();
  if (heroBox && layerBox) {
    // The band is a slice at the very top, measured to end above the skyline
    // and the headline, so the clouds stay small sky details.
    expect(layerBox.y).toBe(heroBox.y);
    expect(layerBox.height).toBeGreaterThan(60);
    expect(layerBox.height).toBeLessThanOrEqual(152);
    expect(layerBox.height).toBeLessThan(heroBox.height * 0.35);
  }
  const surface = await layer.locator("canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    return { width: canvas.width, height: canvas.height };
  });
  expect(surface.width).toBeGreaterThan(0);
  expect(surface.height).toBeGreaterThan(0);
  // The headline and search controls never wait for the enhancement.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Search", exact: true }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(layer).toHaveCount(0);
  await expect(page.locator(".ribbon-field canvas")).toBeVisible();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator('[data-hero-layer="clouds"] canvas')).toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("canvas")).toHaveCount(0);
  // The product's own markup must hydrate without any React mismatch report.
  expect(hydration).toEqual([]);
});

test("extension marker attributes are cleared before React hydrates the landing", async ({
  page,
}) => {
  // Web-protection and wallet extensions stamp markers such as
  // `bis_skin_checked`, `bis_register`, and `__processed_<uuid>__` onto parsed
  // elements before React hydrates. React compares those attributes against the
  // server HTML and reports a mismatch no product code caused, so the
  // development-only guard clears the markers while the document is parsed.
  const hydration: string[] = [];
  page.on("console", (message) => {
    if (/hydrat/i.test(message.text())) hydration.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (/hydrat/i.test(error.message)) hydration.push(error.message);
  });

  await page.addInitScript(() => {
    type Stamped = Window & { stampedElements?: number };
    const markers: [string, string][] = [
      ["bis_skin_checked", "1"],
      ["bis_register", "W3sibWFzdGVyIjp0cnVlLCJleHRlbnNpb25JZCI6ImVwcGlvY2Vt"],
      ["__processed_6213789c-f527-4a9c-b395-19b8840a9ad6__", "true"],
    ];
    let stamped = 0;
    const stamp = (element: Element) => {
      for (const [name, value] of markers) element.setAttribute(name, value);
      stamped += 1;
    };
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.target.nodeType === 1) stamp(record.target as Element);
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          stamp(node as Element);
          (node as Element).querySelectorAll("*").forEach(stamp);
        }
      }
    });
    // The init script runs before the parser creates <html>, so the document
    // itself is observed and every element arrives as a childList mutation.
    observer.observe(document, { subtree: true, childList: true });
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        observer.disconnect();
        (window as Stamped).stampedElements = stamped;
      },
      { once: true },
    );
  });

  await page.goto("/");
  // The simulation really stamped the page; the guard is what removed it.
  const stamped = await page.evaluate(
    () =>
      (window as Window & { stampedElements?: number }).stampedElements ?? 0,
  );
  expect(stamped).toBeGreaterThan(10);
  await expect(page.locator("[bis_skin_checked]")).toHaveCount(0);
  await expect(page.locator("[bis_register]")).toHaveCount(0);
  await expect(
    page.locator("[__processed_6213789c-f527-4a9c-b395-19b8840a9ad6__]"),
  ).toHaveCount(0);
  // No React hydration report survives, and hydration still completes: client
  // state changes reach the DOM.
  expect(hydration).toEqual([]);
  await page.getByRole("button", { name: "Switch to Khmer" }).click();
  const heroHeading = page.getByRole("heading", { level: 1 });
  await expect(heroHeading).toHaveAttribute("lang", "km");
  await expect(heroHeading).toContainText("និងនៅជិតសាលាអ្នកបំផុត");
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
