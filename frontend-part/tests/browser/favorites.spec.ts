import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { FavoriteDto } from "@findme/contracts";
import { englishTitle, institution, listings, rental } from "./fixtures.ts";

const first = listings[0];
if (!first) throw new Error("Favorite fixture is required.");
const savedRow: FavoriteDto = {
  listingId: first.id,
  savedAt: "2026-09-06T00:00:00Z",
  listing: first,
};
const searchHref = `/search?institution=${institution.slug}&maxRentUsd=250`;

async function favoriteApi(page: Page, initial: FavoriteDto[] = []) {
  const state = {
    role: "STUDENT" as "STUDENT" | "LANDLORD" | "GUEST" | "INCOMPLETE",
    rows: initial,
    failRead: false,
    failWrite: false,
    writes: 0,
    delayRead: 0,
  };
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#dedfcf"/><text x="400" y="300" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#34362b">Test rental photo</text></svg>',
    }),
  );
  await page.route("http://127.0.0.1:3102/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const send = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
        headers: {
          "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    const error = (code: string, status = 503) =>
      send({ error: { code, message: "Fixture error" } }, status);
    if (url.pathname === "/api/v1/auth/login") {
      state.role = "STUDENT";
      return send({
        data: {
          accessToken: "test-access-token",
          accessTokenExpiresInSeconds: 900,
          user: { id: "student-a", role: state.role, onboardingComplete: true },
        },
      });
    }
    if (url.pathname === "/api/v1/auth/refresh")
      return state.role === "GUEST"
        ? error("SESSION_REQUIRED", 401)
        : send({
            data: {
              accessToken: "test-access-token",
              accessTokenExpiresInSeconds: 900,
              user: {
                id: "student-a",
                role: state.role,
                onboardingComplete: true,
              },
            },
          });
    if (url.pathname === "/api/v1/me/onboarding")
      return state.role === "GUEST"
        ? error("SESSION_INVALID", 401)
        : send({
            data: {
              role: state.role === "INCOMPLETE" ? null : state.role,
              stage:
                state.role === "INCOMPLETE" ? "ROLE_SELECTION" : "COMPLETE",
              nextPath:
                state.role === "LANDLORD"
                  ? "/landlord"
                  : state.role === "INCOMPLETE"
                    ? "/onboarding/role"
                    : "/search",
            },
          });
    if (!url.pathname.startsWith("/api/v1/me/favorites"))
      return route.fallback();
    if (state.role === "GUEST") return error("SESSION_INVALID", 401);
    if (method === "GET") {
      if (state.delayRead)
        await new Promise((resolve) => setTimeout(resolve, state.delayRead));
      if (state.failRead) return error("REQUEST_FAILED");
      const ids = url.searchParams.get("listingIds")?.split(",");
      const rows = ids
        ? state.rows.filter((row) => ids.includes(row.listingId))
        : state.rows;
      const pageNumber = Number(url.searchParams.get("page"));
      const pageSize = Number(url.searchParams.get("pageSize"));
      return send({
        data: rows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
        meta: {
          page: pageNumber,
          pageSize,
          total: rows.length,
          totalPages: Math.ceil(rows.length / pageSize),
        },
      });
    }
    state.writes += 1;
    if (state.failWrite) return error("REQUEST_FAILED");
    const id = url.pathname.split("/").at(-1);
    if (!id) throw new Error("Missing listing ID.");
    if (method === "PUT" && !state.rows.some((row) => row.listingId === id)) {
      const listing = listings.find((item) => item.id === id);
      if (!listing) return error("LISTING_NOT_FOUND", 404);
      state.rows.unshift({
        listingId: id,
        savedAt: "2026-09-06T00:00:00Z",
        listing,
      });
    }
    if (method === "DELETE")
      state.rows = state.rows.filter((row) => row.listingId !== id);
    return send({ data: { listingId: id, saved: method === "PUT" } });
  });
  return state;
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

test("student saves from search, sees saved state on detail and manages a persistent shortlist", async ({
  page,
}) => {
  const state = await favoriteApi(page);
  await page.goto(searchHref);
  const save = page.getByRole("button", {
    name: `Save rental: ${englishTitle}`,
    exact: true,
  });
  await expect(save).toBeEnabled();
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: `Remove saved rental: ${englishTitle}` }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: englishTitle, exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Remove saved rental: ${englishTitle}` }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Saved rentals", exact: true }).click();
  await expect(page.getByText("1 saved rental", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: englishTitle })).toBeVisible();
  await page
    .getByRole("button", { name: `Remove saved rental: ${englishTitle}` })
    .click();
  await expect(
    page.getByRole("heading", { name: "No saved rentals yet" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Saved rentals", exact: true }),
  ).toBeFocused();
  expect(state.writes).toBe(2);
});

test("guest sign-in returns to the same rental without automatically saving it", async ({
  page,
}) => {
  const state = await favoriteApi(page);
  state.role = "GUEST";
  await page.goto(`/rentals/${rental.slug}`);
  await page
    .getByRole("link", { name: `Sign in to save ${englishTitle}` })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/login\\?next=%2Frentals%2F${rental.slug}`),
  );
  await page.getByLabel("Email address").fill("student@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("student-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/rentals/${rental.slug}$`));
  await expect(
    page.getByRole("button", { name: `Save rental: ${englishTitle}` }),
  ).toBeEnabled();
  expect(state.writes).toBe(0);
});

test("saved rentals cover loading, errors, retry, failed removal, unavailable rows and session loss", async ({
  page,
}) => {
  const state = await favoriteApi(page, [{ ...savedRow, listing: null }]);
  state.delayRead = 800;
  state.failRead = true;
  await page.goto("/favorites");
  await expect(page.getByText("Loading your saved rentals…")).toBeVisible();
  await page.getByRole("button", { name: "Retry saved rentals" }).waitFor();
  state.delayRead = 0;
  state.failRead = false;
  await page.getByRole("button", { name: "Retry saved rentals" }).click();
  await expect(
    page.getByRole("heading", { name: "Rental no longer available" }),
  ).toBeVisible();
  expect(await page.getByRole("link", { name: englishTitle }).count()).toBe(0);
  state.failWrite = true;
  await page
    .getByRole("button", {
      name: "Remove saved rental: Rental no longer available",
    })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Could not update",
  );
  await expect(
    page.getByRole("button", {
      name: "Remove saved rental: Rental no longer available",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  state.failWrite = false;
  await page
    .getByRole("button", {
      name: "Remove saved rental: Rental no longer available",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "No saved rentals yet" }),
  ).toBeVisible();
  state.role = "GUEST";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("heading", { name: "Sign in to see your saved rentals" }),
  ).toBeVisible();
});

test("landlord and incomplete accounts get useful permission states", async ({
  page,
}) => {
  const state = await favoriteApi(page);
  state.role = "LANDLORD";
  await page.goto("/favorites");
  await expect(
    page.getByRole("heading", {
      name: "Saved rentals are for student accounts",
    }),
  ).toBeVisible();
  state.role = "INCOMPLETE";
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Continue account setup" }),
  ).toHaveAttribute("href", "/onboarding/role?next=%2Ffavorites");
  expect(state.writes).toBe(0);
});

test("removing the final rental on a later page returns to the remaining saved rentals", async ({
  page,
}) => {
  const rows = Array.from({ length: 13 }, (_, index) => ({
    ...savedRow,
    listingId: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
    listing: null,
  }));
  await favoriteApi(page, rows);
  await page.goto("/favorites");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Saved rental pages" }),
  ).toContainText("Page 2 of 2");
  await page
    .getByRole("button", {
      name: "Remove saved rental: Rental no longer available",
    })
    .click();
  await expect(
    page.getByText("12 saved rentals", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Remove saved rental: Rental no longer available",
    }),
  ).toHaveCount(12);
});

for (const width of [320, 390, 768, 1440]) {
  test(`saved rentals reflow with Khmer and long titles at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await favoriteApi(
      page,
      listings.map((listing) => ({
        listingId: listing.id,
        savedAt: savedRow.savedAt,
        listing,
      })),
    );
    await page.goto("/favorites");
    await expect(
      page.getByRole("heading", { name: englishTitle }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
    const remove = page.getByRole("button", {
      name: `Remove saved rental: ${englishTitle}`,
    });
    expect((await remove.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await remove.focus();
    await expect(remove).toBeFocused();
    await capture(page, `favorites-${width}`);
  });
}
