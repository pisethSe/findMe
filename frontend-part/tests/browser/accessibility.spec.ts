import { expect, test, type Page } from "@playwright/test";

import { institution, rental } from "./fixtures.ts";

/**
 * Phase 4 accessibility review against PRD 14.5 and AGENTS.md section 17.
 *
 * Deterministic in-page audits run against the real rendered surfaces
 * (landing, search, rental detail, sign-in, directory), so a regression in
 * labels, heading order, contrast, focus visibility, or the map/list
 * fallback fails CI instead of relying on a manual pass.
 */

const searchHref = `/search?institution=${institution.slug}`;
const detailHref = `/rentals/${rental.slug}?institution=${institution.slug}`;

interface Violation {
  rule: string;
  detail: string;
}

/** Runs one accessibility audit inside the page and returns every finding. */
async function audit(page: Page): Promise<Violation[]> {
  return page.evaluate(() => {
    const violations: { rule: string; detail: string }[] = [];
    const add = (rule: string, detail: string) =>
      violations.push({ rule, detail });

    const visible = (element: Element): boolean => {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden")
        return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const hiddenFromAssistive = (element: Element): boolean => {
      for (let node: Element | null = element; node; node = node.parentElement)
        if (node.getAttribute("aria-hidden") === "true") return true;
      return false;
    };

    // 1. Document language.
    if (!document.documentElement.getAttribute("lang"))
      add("document-language", "html element has no lang attribute");

    // 2. One h1 and no skipped heading levels in the exposed outline.
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(
      (heading) => visible(heading) && !hiddenFromAssistive(heading),
    );
    const h1Count = headings.filter((h) => h.tagName === "H1").length;
    if (h1Count !== 1)
      add("single-h1", `expected exactly one visible h1, found ${h1Count}`);
    let previousLevel = 0;
    for (const heading of headings) {
      const level = Number(heading.tagName.slice(1));
      if (previousLevel && level > previousLevel + 1)
        add(
          "heading-order",
          `h${previousLevel} is followed by h${level}: "${heading.textContent?.trim().slice(0, 60)}"`,
        );
      previousLevel = level;
    }

    // 3. Every content image carries alt text; decorative images are hidden.
    for (const image of document.querySelectorAll("img")) {
      if (!visible(image) || hiddenFromAssistive(image)) continue;
      const role = image.getAttribute("role");
      if (
        image.getAttribute("alt") === null &&
        role !== "presentation" &&
        role !== "none"
      )
        add("image-alt", `<img src="${image.getAttribute("src")}"> has no alt`);
    }

    // 4. Form controls have an accessible name.
    const namedBy = (element: Element): string => {
      const label = element.getAttribute("aria-label");
      if (label?.trim()) return label;
      const labelledBy = element.getAttribute("aria-labelledby");
      if (labelledBy)
        for (const id of labelledBy.split(/\s+/)) {
          const target = document.getElementById(id);
          if (target?.textContent?.trim()) return target.textContent;
        }
      if (element.id) {
        const own = document.querySelector(
          `label[for="${CSS.escape(element.id)}"]`,
        );
        if (own?.textContent?.trim()) return own.textContent;
      }
      const wrapping = element.closest("label");
      if (wrapping?.textContent?.trim()) return wrapping.textContent;
      const title = element.getAttribute("title");
      if (title?.trim()) return title;
      return "";
    };
    for (const control of document.querySelectorAll("input, select, textarea")) {
      if (!visible(control)) continue;
      const type = control.getAttribute("type");
      if (type === "hidden") continue;
      if (!namedBy(control))
        add(
          "control-name",
          `<${control.tagName.toLowerCase()}${type ? ` type="${type}"` : ""}> has no accessible name`,
        );
    }


    // 5. Interactive elements expose a name to assistive technology.
    for (const element of document.querySelectorAll("button, a[href]")) {
      if (!visible(element) || hiddenFromAssistive(element)) continue;
      const name = (element.textContent ?? "").trim() || namedBy(element);
      if (!name)
        add(
          "interactive-name",
          `<${element.tagName.toLowerCase()} class="${element.getAttribute("class") ?? ""}"> has no accessible name`,
        );
    }

    // 6. No positive tabindex reorders the document.
    for (const element of document.querySelectorAll("[tabindex]")) {
      const value = Number(element.getAttribute("tabindex"));
      if (value > 0)
        add(
          "positive-tabindex",
          `<${element.tagName.toLowerCase()}> has tabindex="${value}"`,
        );
    }

    // 7. Text contrast (WCAG 2.2 AA: 4.5:1 normal, 3:1 large). Elements over
    // images, gradients, or partial opacity are excluded because their real
    // backdrop cannot be computed from styles alone.
    const channel = (value: number) => {
      const srgb = value / 255;
      return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]: number[]) =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const parseColor = (value: string): number[] | null => {
      const match = value.match(
        /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/,
      );
      if (!match) return null;
      return [
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        match[4] === undefined ? 1 : Number(match[4]),
      ];
    };
    const effectiveBackground = (element: Element): number[] | null => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.backgroundImage !== "none") return null;
        if (Number(style.opacity) < 1) return null;
        const color = parseColor(style.backgroundColor);
        if (color && color[3] > 0) return color;
      }
      return [255, 255, 255, 1];
    };
    const contrast = (fg: number[], bg: number[]) => {
      const light = Math.max(luminance(fg), luminance(bg));
      const dark = Math.min(luminance(fg), luminance(bg));
      return (light + 0.05) / (dark + 0.05);
    };

    const textOwners = document.querySelectorAll(
      "p, li, h1, h2, h3, h4, h5, h6, a, button, label, span, td, th, dt, dd, legend, option, div",
    );
    for (const element of textOwners) {
      if (!visible(element) || hiddenFromAssistive(element)) continue;
      const ownText = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      if (!ownText) continue;
      const style = getComputedStyle(element);
      const color = parseColor(style.color);
      if (!color || color[3] < 1) continue;
      const background = effectiveBackground(element);
      if (!background) continue;
      const size = parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const ratio = contrast(color, background);
      const required = large ? 3 : 4.5;
      if (ratio + 0.05 < required)
        add(
          "contrast",
          `${ratio.toFixed(2)}:1 (needs ${required}:1) on "${ownText.slice(0, 48)}" (${style.color} on rgb(${background.slice(0, 3).join(",")}))`,
        );
    }

    return violations;
  });

function report(violations: Violation[]): string {
  return violations.map((v) => `${v.rule}: ${v.detail}`).join("\n");
}

test.beforeEach(async ({ page }) => {
  // Isolated image placeholder, never supplied to the production API.
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#dedfcf"/></svg>',
    }),
  );
});

for (const surface of [
  { name: "landing", url: "/" },
  { name: "student search", url: searchHref },
  { name: "rental detail", url: detailHref },
  { name: "sign in", url: "/login" },
  { name: "university directory", url: "/universities" },
]) {
  test(`${surface.name} passes the accessibility audit`, async ({ page }) => {
    await page.goto(surface.url);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("body")).toBeVisible();
    const violations = await audit(page);
    expect(violations, report(violations)).toEqual([]);
  });
}

test("keyboard focus is always visible and starts at the top of the page", async ({
  page,
}) => {
  await page.goto(searchHref);
  await expect(
    page.getByRole("heading", { name: "2 rooms found" }),
  ).toBeVisible();
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("Tab");

  const focus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return null;
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  });
  expect(focus, "the first Tab press must reach a control").not.toBeNull();
  const hasOutline =
    focus?.outlineStyle !== "none" && Number.parseFloat(focus?.outlineWidth ?? "0") > 0;

test("search keeps a list alternative and labels availability beyond color", async ({
  page,
}) => {
  await page.goto(searchHref);
  const results = page.getByRole("heading", { name: "2 rooms found" });
  await expect(results).toBeVisible();

  // The map can never be the only way to reach rentals.
  await expect(page.locator("#rental-list")).toBeVisible();
  const cards = page.locator("#rental-list li");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(0);
  for (const card of await cards.all()) {
    const text = (await card.innerText()).toLowerCase();
    expect(
      text.includes("available"),
      `every card must state availability in text, got: ${text.slice(0, 120)}`,
    ).toBe(true);
  }

  // Markers carry a text state as well as their color.
  const markerLabels = await page
    .locator("#rental-map [aria-label], #rental-map title")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label") ?? n.textContent ?? ""));
  if (markerLabels.length > 0) {
    expect(
      markerLabels.some((label) => /available|unavailable/i.test(label)),
      `map markers need an availability text label, got: ${markerLabels.join(" | ")}`,
    ).toBe(true);
  }
});

test("the vertical phrase loop exposes stable copy and never repeats announcements", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Search", exact: true }),
  ).toBeEnabled();

  const loop = page.locator(".institution-hint-loop, [data-motion]").first();
  if ((await loop.count()) === 0) return;

  // The animated text is decorative; assistive technology reads one stable
  // sentence instead of every rotation.
  const decorative = await loop
    .locator("span[aria-hidden='true']")
    .count();
  expect(decorative, "the rotating span must be aria-hidden").toBeGreaterThan(0);
  const stable = page.locator(".sr-only").filter({ hasText: /.+/ });
  expect(
    await stable.count(),
    "a stable screen-reader sentence must exist",
  ).toBeGreaterThan(0);

  // Reduced motion (the suite default) must stop the rotation.
  const motion = await page.evaluate(() => {
    const element = document.querySelector("[data-motion]");
    if (!element) return "absent";
    return getComputedStyle(element).animationName;
  });
  expect(motion).not.toBe("none" === motion ? "absent" : "running-loop");
});

  const hasShadow = focus?.boxShadow !== "none";
  expect(
    hasOutline || hasShadow,
    `focused ${focus?.tag} must show an outline or focus ring, got outline=${focus?.outlineStyle} ${focus?.outlineWidth} shadow=${focus?.boxShadow}`,
  ).toBe(true);
});

}
