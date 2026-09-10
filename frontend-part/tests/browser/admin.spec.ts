import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
const report = {
  id: "770cb2d4-b6ea-4a08-818b-611b93414e8d",
  reason: "INACCURATE",
  details:
    "The landlord quoted a different monthly price. សូមពិនិត្យព័ត៌មានបន្ទប់ជួល។",
  status: "OPEN",
  resolutionNote: null,
  resolvedAt: null,
  createdAt: "2026-09-10T00:00:00Z",
  updatedAt: "2026-09-10T00:00:00Z",
  listing: {
    id: "770cb2d4-b6ea-4a08-818b-611b93414e8a",
    slug: "room",
    titleEn: "Student room near the university",
    titleKm: "បន្ទប់ជួល",
    status: "PUBLISHED",
    landlordId: "770cb2d4-b6ea-4a08-818b-611b93414e8b",
  },
};
async function api(page: Page) {
  const state = {
    role: "ADMIN",
    failRead: false,
    failWrite: false,
    report: { ...report },
    user: {
      id: report.listing.landlordId,
      displayName: "Landlord account",
      role: "LANDLORD",
      accountStatus: "ACTIVE",
      createdAt: report.createdAt,
    },
    empty: false,
  };
  await page.route("http://127.0.0.1:3102/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
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
    if (path.endsWith("/auth/refresh"))
      return send({
        data: {
          accessToken: "test",
          accessTokenExpiresInSeconds: 900,
          user: { id: "admin", role: state.role, onboardingComplete: true },
        },
      });
    if (path.endsWith("/me/onboarding"))
      return send({
        data: {
          role: state.role,
          stage: "COMPLETE",
          nextPath: state.role === "ADMIN" ? "/admin" : "/search",
        },
      });
    if (path === "/api/v1/admin/listings" && method === "GET")
      return send({
        data: [
          {
            id: report.listing.id,
            status: "PUBLISHED",
            propertyType: "ROOM",
            titleEn: "Rental under review",
            titleKm: "បន្ទប់ជួល",
            descriptionEn: "A room near the university with a study desk.",
            descriptionKm: null,
            monthlyPrice: 120,
            currency: "USD",
            availableUnits: 2,
            property: {
              name: "Student rooms",
              addressLine: "University road",
              city: "Phnom Penh",
              latitude: 11.57,
              longitude: 104.89,
              totalUnits: 3,
            },
            landlord: {
              displayName: "Rental owner",
              verificationStatus: "UNVERIFIED",
            },
            images: [],
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });
    if (path.includes("/admin/")) {
      if (
        (method === "GET" && state.failRead) ||
        (method !== "GET" && state.failWrite)
      )
        return send(
          { error: { code: "ADMIN_STATE_CONFLICT", message: "Refresh" } },
          409,
        );
      if (path.endsWith("/reports") && method === "GET")
        return send({
          data: state.empty ? [] : [state.report],
          meta: {
            page: 1,
            pageSize: 20,
            total: state.empty ? 0 : 1,
            totalPages: state.empty ? 0 : 1,
          },
        });
      if (path.includes("/reports/") && method === "PATCH") {
        state.report = { ...state.report, ...route.request().postDataJSON() };
        return send({ data: state.report });
      }
      if (path.endsWith("/users") && method === "GET")
        return send({
          data: [state.user],
          meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        });
      if (path.endsWith("/suspend")) {
        state.user.accountStatus = "SUSPENDED";
        return send({ data: state.user });
      }
      if (path.endsWith("/reactivate")) {
        state.user.accountStatus = "ACTIVE";
        return send({ data: state.user });
      }
      if (path.endsWith("/institutions") && method === "GET")
        return send({
          data: [],
          meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        });
      if (path.endsWith("/institutions") && method === "POST")
        return send(
          { data: { id: report.id, ...route.request().postDataJSON() } },
          201,
        );
    }
    return route.fallback();
  });
  return state;
}
for (const width of [320, 390, 768, 1440])
  test(`admin report review and account actions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await api(page);
    await page.goto("/admin/reports");
    await expect(
      page.getByRole("heading", { name: "INACCURATE", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Resolve report" }).click();
    await expect(page.getByLabel("Decision note (required)")).toBeFocused();
    await page
      .getByLabel("Decision note (required)")
      .fill("Checked the listing and confirmed incorrect price.");
    state.failWrite = true;
    await page.getByRole("button", { name: "Resolve report" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "could not be confirmed",
    );
    await mkdir("test-results/admin", { recursive: true });
    await page.screenshot({
      path: `test-results/admin/${width}-reports.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    state.failWrite = false;
    await page.getByRole("button", { name: "Resolve report" }).click();
    await expect(page.getByRole("status")).toContainText("Action saved");
    await page.goto("/admin/users");
    await page
      .getByLabel("Decision note (required)")
      .fill("Confirmed account abuse.");
    await page
      .getByRole("button", { name: "Suspend account", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Reactivate account", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Decision note (required)")
      .fill("The account issue has been corrected.");
    await page
      .getByRole("button", { name: "Reactivate account", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Suspend account", exact: true }),
    ).toBeVisible();
  });
test("admin access, empty/error recovery and catalog creation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = await api(page);
  state.role = "STUDENT";
  await page.goto("/admin/reports");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Administrator access is required",
  );
  state.role = "ADMIN";
  state.failRead = true;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry loading" }),
  ).toBeVisible();
  state.failRead = false;
  state.empty = true;
  await page.getByRole("button", { name: "Retry loading" }).click();
  await expect(
    page.getByText("No records match this view.", { exact: false }),
  ).toBeVisible();
  await page.goto("/admin/institutions");
  await page
    .getByRole("button", { name: "Add institution", exact: true })
    .click();
  await page.getByLabel("English name").fill("University test campus");
  await page.getByLabel("Khmer name").fill("សាកលវិទ្យាល័យ");
  await page.getByLabel("URL slug").fill("university-test-campus");
  await page.getByLabel("Address", { exact: true }).fill("Phnom Penh campus");
  await page.getByLabel("Latitude").fill("11.57");
  await page.getByLabel("Longitude").fill("104.89");
  await page.screenshot({
    path: "test-results/admin/catalog-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Save catalog record" }).click();
  await expect(page.getByRole("status")).toContainText("Catalog saved");
});

for (const width of [390, 1440])
  test(`admin rental review at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await api(page);
    await page.goto("/admin/listings");
    await expect(
      page.getByRole("heading", { name: "Rental under review", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Check pin", exact: false }),
    ).toHaveAttribute("href", /11.57/);
    await expect(
      page.getByRole("button", { name: "Pause rental", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approve and publish", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/admin/${width}-listing.png`,
      fullPage: true,
    });
  });
