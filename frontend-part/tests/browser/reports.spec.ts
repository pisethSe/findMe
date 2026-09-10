import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { rental } from "./fixtures.ts";

for (const width of [320, 390, 768, 1440]) {
  test(`report form supports keyboard, errors and success at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/_next/image?**", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#dedfcf"/></svg>',
      }),
    );
    let failure = true;
    let guest = false;
    await page.route("http://127.0.0.1:3102/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const send = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
          headers: {
            "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
            "Access-Control-Allow-Credentials": "true",
          },
        });
      if (path.endsWith("/auth/refresh"))
        return guest
          ? send(
              { error: { code: "SESSION_REQUIRED", message: "Sign in" } },
              401,
            )
          : send({
              data: {
                accessToken: "test-token",
                accessTokenExpiresInSeconds: 900,
                user: {
                  id: "student-a",
                  role: "STUDENT",
                  onboardingComplete: true,
                },
              },
            });
      if (path.endsWith("/me/onboarding"))
        return send({
          data: { role: "STUDENT", stage: "COMPLETE", nextPath: "/search" },
        });
      if (path.endsWith("/me/favorites"))
        return send({
          data: [],
          meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
        });
      if (path.endsWith("/reports")) {
        expect(route.request().postDataJSON()).toEqual({
          reason: "UNAVAILABLE",
          details: "បន្ទប់នេះលែងទំនេរ",
        });
        if (guest)
          return send(
            { error: { code: "SESSION_REQUIRED", message: "Sign in" } },
            401,
          );
        if (failure)
          return send(
            { error: { code: "REPORT_RATE_LIMITED", message: "Wait" } },
            429,
          );
        return send(
          {
            data: {
              id: "770cb2d4-b6ea-4a08-818b-611b93414e8d",
              received: true,
            },
          },
          201,
        );
      }
      return route.fallback();
    });
    await page.goto(`/rentals/${rental.slug}`);
    await expect(
      page.getByRole("button", { name: "Send inquiry", exact: true }),
    ).toBeVisible();
    const summary = page.getByText("Report this rental", { exact: true });
    await summary.focus();
    await page.keyboard.press("Enter");
    await page
      .getByLabel("Reason", { exact: true })
      .selectOption("UNAVAILABLE");
    await page.getByLabel("Details (optional)").fill("បន្ទប់នេះលែងទំនេរ");
    await page
      .getByRole("button", { name: "Submit report", exact: true })
      .click();
    await expect(
      page.getByText("You’ve reached the report limit.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByLabel("Details (optional)")).toHaveValue(
      "បន្ទប់នេះលែងទំនេរ",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await mkdir("test-results/reports", { recursive: true });
    await page.screenshot({
      path: `test-results/reports/${width}-error.png`,
      fullPage: true,
    });
    guest = true;
    await page
      .getByRole("button", { name: "Submit report", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Sign in to report this rental" }),
    ).toHaveAttribute("href", /next=/);
    guest = false;
    failure = false;
    await page
      .getByRole("button", { name: "Submit report", exact: true })
      .click();
    await expect(
      page.getByText("Your report has been received for review.", {
        exact: false,
      }),
    ).toBeVisible();
  });
}
