import { expect, test } from "@playwright/test";
import {
  access,
  amenity,
  deferred,
  listingId,
  ownedRental,
  rentalBasics,
  rentalReview,
  supplyApi,
  titleKm,
} from "./supply-fixtures";

test("draft creation validates units, preserves Khmer and coordinates, and is editable after reload", async ({
  page,
}) => {
  const state = await supplyApi(page);
  await page.goto("/landlord/listings/new");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByLabel("Property or rental name", { exact: true }),
  ).toBeFocused();
  await rentalBasics(page);
  await page.getByLabel("Available now", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByLabel("Available now", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  expect(state.writes).toHaveLength(0);
  await page.getByLabel("Available now", { exact: true }).fill("2");
  await rentalReview(page);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your draft is ready when you are." }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toEqual({
    path: "/landlord/listings",
    method: "POST",
    body: {
      property: {
        name: "University rooms",
        addressLine: "Street 138, Phnom Penh",
        city: "Phnom Penh",
        countryCode: "KH",
        latitude: 11.569,
        longitude: 104.8914,
        totalUnits: 3,
      },
      titleKm,
      propertyType: "ROOM",
      monthlyPrice: 95,
      currency: "USD",
      availableUnits: 2,
      descriptionEn: "Quiet room with space to study.",
      furnished: false,
      contactPreference: "IN_APP_ONLY",
      amenityIds: [amenity.id],
    },
  });
  await page.goto(`/landlord/listings/${listingId}/edit`);
  await page.reload();
  await expect(page.getByLabel("Listing title in Khmer")).toHaveValue(titleKm);
  await expect(
    page.getByLabel("Available now", { exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Monthly rent", { exact: true }).fill("105");
  for (let step = 0; step < 3; step++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your rental changes are saved." }),
  ).toBeVisible();
  expect(state.writes[1]?.method).toBe("PATCH");
  expect(state.writes[1]?.body).not.toHaveProperty("availableUnits");
  expect(state.listing?.monthlyPrice).toBe(105);
  expect(state.listing?.property.latitude).toBe(11.569);
});

test("failed photo upload retains the draft and retry submits it once without recreating the rental", async ({
  page,
}) => {
  const state = await supplyApi(page);
  state.failUpload = true;
  await page.goto("/landlord/listings/new");
  await rentalBasics(page);
  await rentalReview(page);
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(page.locator("#listingPhotos")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(state.writes).toHaveLength(0);
  await page.getByLabel(/Choose rental photos/).setInputFiles({
    name: "room.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your rental details are safe." }),
  ).toBeVisible();
  expect(state.listing?.status).toBe("DRAFT");
  expect(
    state.writes.some(
      ({ path, method }) => path.startsWith("/media/") && method === "DELETE",
    ),
  ).toBe(true);
  expect(state.writes.some(({ path }) => path.endsWith("/submit"))).toBe(false);
  state.failUpload = false;
  await page.getByRole("button", { name: "Retry photo upload" }).click();
  await expect(
    page.getByRole("heading", { name: "Your rental is ready for review." }),
  ).toBeVisible();
  await expect(page.getByText("1 uploaded", { exact: true })).toBeVisible();
  expect(
    state.writes.filter(
      ({ path, method }) => path === "/landlord/listings" && method === "POST",
    ),
  ).toHaveLength(1);
  expect(
    state.writes.filter(({ path }) => path.endsWith("/submit")),
  ).toHaveLength(1);
  expect(state.listing?.status).toBe("PENDING_REVIEW");
  expect(state.listing?.images).toHaveLength(1);
});

test("loading and read errors recover, and a server-denied save keeps entered data", async ({
  page,
}) => {
  const state = await supplyApi(page);
  const gate = deferred();
  state.readGate = gate.promise;
  state.failRead = true;
  await page.goto("/landlord/listings/new");
  await expect(page.getByText("Preparing your rental form…")).toBeVisible();
  gate.resolve();
  await expect(
    page.getByRole("heading", { name: "Rental form unavailable" }),
  ).toBeVisible();
  state.failRead = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await rentalBasics(page);
  await rentalReview(page);
  state.failSave = true;
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Please try again.",
  );
  expect(state.listing).toBeNull();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Description in English")).toHaveValue(
    "Quiet room with space to study.",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  state.failSave = false;
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your draft is ready when you are." }),
  ).toBeVisible();
});

test("expired access blocks new rentals while keeping existing drafts readable and editable", async ({
  page,
}) => {
  const state = await supplyApi(page);
  state.entitlement = access(false);
  state.listing = ownedRental();
  await page.goto("/landlord/listings/new");
  await expect(
    page.getByRole("heading", {
      name: "Your saved rental data is still here.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Open landlord workspace" }).click();
  await expect(
    page.getByRole("heading", { name: titleKm, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Add rental unavailable", { exact: true }),
  ).toBeVisible();
  await page.goto(`/landlord/listings/${listingId}/edit`);
  await expect(page.getByLabel("Monthly rent", { exact: true })).toHaveValue(
    "95",
  );
  for (let step = 0; step < 3; step++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Submit for review", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel(/Choose rental photos/)).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

for (const width of [320, 390, 768, 1440]) {
  test(`landlord wizard and dashboard fit at ${width}px with Khmer content`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await supplyApi(page);
    await page.goto("/landlord/listings/new");
    await rentalBasics(page);
    for (let step = 0; step < 4; step++) {
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width + 1);
      if (step === 3) {
        await page.screenshot({
          path: testInfo.outputPath("rental-review.png"),
          fullPage: true,
        });
        break;
      }
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      if (step === 0) {
        await page
          .getByLabel("Address students can recognize")
          .fill("Street 138, Phnom Penh");
        await page.getByLabel("Latitude", { exact: true }).fill("11.569");
        await page.getByLabel("Longitude", { exact: true }).fill("104.8914");
      }
      if (step === 1)
        await page
          .getByLabel("Description in English")
          .fill("Quiet room with space to study.");
    }
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("link", { name: "Open landlord workspace" }).click();
    await expect(
      page.getByRole("heading", { name: titleKm, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
    await page.screenshot({
      path: testInfo.outputPath("landlord-dashboard.png"),
      fullPage: true,
    });
  });
}
