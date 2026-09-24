import { expect, test } from "@playwright/test";
import {
  access,
  deferred,
  listingId,
  ownedRental,
  supplyApi,
  titleKm,
} from "./supply-fixtures";

function staleRental() {
  return {
    ...ownedRental(),
    status: "PUBLISHED" as const,
    availabilityConfirmedAt: "2026-08-01T00:00:00Z",
    availabilityFreshness: {
      state: "STALE" as const,
      remindAt: "2026-08-08T00:00:00Z",
      expiresAt: "2026-08-15T00:00:00Z",
    },
  };
}

for (const width of [320, 390, 768, 1440]) {
  test(`overdue availability is understandable and keyboard-confirmable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await supplyApi(page);
    state.listing = staleRental();
    await page.goto("/landlord");
    await expect(
      page.getByRole("heading", { name: titleKm, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Availability overdue · Hidden from students"),
    ).toBeVisible();
    const reminder = page.getByText(
      "Hidden from students until you confirm how many rooms are available.",
    );
    await expect(reminder).toBeVisible();
    const input = page.getByLabel("Available rooms", { exact: true });
    await expect(input).toHaveValue("2");
    await input.focus();
    await page.keyboard.press("Tab");
    const confirm = page.getByRole("button", { name: "Confirm", exact: true });
    await expect(confirm).toBeFocused();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
    await page.screenshot({
      path: testInfo.outputPath("stale-dashboard.png"),
      fullPage: true,
    });
    const gate = deferred();
    state.saveGate = gate.promise;
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Confirming…" }),
    ).toBeDisabled();
    gate.resolve();
    await expect(page.getByRole("status")).toContainText(
      "Availability confirmed.",
    );
    await expect(
      page.getByText("Published · Visible to students"),
    ).toBeVisible();
    await expect(reminder).toHaveCount(0);
    expect(state.writes).toEqual([
      {
        path: `/landlord/listings/${listingId}/availability`,
        method: "PATCH",
        body: { availableUnits: 2 },
      },
    ]);
    await page.reload();
    await expect(
      page.getByText("Published · Visible to students"),
    ).toBeVisible();
  });
}

test("failed confirmation keeps the reminder and allows retry; upcoming deadlines use server state", async ({
  page,
}) => {
  const state = await supplyApi(page);
  state.listing = staleRental();
  state.listing.availabilityFreshness = {
    state: "DUE",
    remindAt: "2026-09-08T00:00:00Z",
    expiresAt: "2026-09-15T00:00:00Z",
  };
  state.failSave = true;
  await page.goto("/landlord");
  const reminder = page.getByText(/Confirm availability by .*Cambodia time/);
  await expect(reminder).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Please try again.",
  );
  await expect(reminder).toBeVisible();
  await expect(page.getByLabel("Available rooms", { exact: true })).toHaveValue(
    "2",
  );
  state.failSave = false;
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(reminder).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "Availability confirmed.",
  );
});

test("expired and archived inventory stays hidden during confirmation", async ({
  page,
}) => {
  const state = await supplyApi(page);
  state.entitlement = access(false);
  state.listing = { ...staleRental(), status: "PAUSED" };
  await page.goto("/landlord");
  await expect(
    page.getByText("Paused · Hidden", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Availability confirmed.",
  );
  await expect(
    page.getByText("Paused · Hidden", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Available rooms", { exact: true }).fill("3");
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Access is required to increase available rooms."),
  ).toBeVisible();
  state.listing.status = "ARCHIVED";
  await page.reload();
  await expect(
    page.getByLabel("Available rooms", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Confirm", exact: true }),
  ).toBeDisabled();
});
