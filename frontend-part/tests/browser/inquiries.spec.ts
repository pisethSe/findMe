import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type {
  InquiryStatus,
  LandlordInquiryDto,
  StudentInquiryDto,
} from "@findme/contracts";

import { englishTitle, khmerTitle, rental } from "./fixtures.ts";

const detailHref = `/rentals/${rental.slug}`;
const studentMessage =
  "Hello, is this room available for a student to visit on Saturday?";
const timestamp = "2026-09-07T00:00:00Z";
const studentRow: StudentInquiryDto = {
  id: "770cb2d4-b6ea-4a08-818b-611b93414e8d",
  message: studentMessage,
  status: "NEW",
  createdAt: timestamp,
  updatedAt: timestamp,
  listing: {
    id: rental.id,
    slug: rental.slug,
    titleEn: englishTitle,
    titleKm: khmerTitle,
  },
};
const landlordRow: LandlordInquiryDto = {
  ...studentRow,
  student: { displayName: "Student moving to Phnom Penh for university" },
  listing: {
    id: rental.id,
    titleEn: englishTitle,
    titleKm: khmerTitle,
    propertyName: "Student rooms near the university",
  },
};

interface CreateRequest {
  message: string;
  clientRequestId: string;
}

interface ApiFailure {
  code: string;
  status: number;
}

async function inquiryApi(page: Page) {
  const state = {
    role: "STUDENT" as "STUDENT" | "LANDLORD" | "GUEST" | "INCOMPLETE",
    studentRows: [] as StudentInquiryDto[],
    landlordRows: [] as LandlordInquiryDto[],
    creates: [] as CreateRequest[],
    statuses: [] as InquiryStatus[],
    committed: new Map<string, StudentInquiryDto>(),
    loseNextCreateResponse: false,
    createFailure: null as ApiFailure | null,
    failRead: false,
    failStatus: false,
    delayRead: 0,
  };
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#dedfcf"/></svg>',
    }),
  );
  await page.route("http://127.0.0.1:3102/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
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
      send({ error: { code, message: "Fixture request failed." } }, status);
    if (url.pathname === "/api/v1/auth/refresh")
      return state.role === "GUEST"
        ? error("SESSION_REQUIRED", 401)
        : send({
            data: {
              accessToken: "test-access-token",
              accessTokenExpiresInSeconds: 900,
              user: {
                id: "student-a",
                role: state.role === "INCOMPLETE" ? null : state.role,
                onboardingComplete: state.role !== "INCOMPLETE",
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
    if (url.pathname === "/api/v1/me/favorites")
      return send({
        data: [],
        meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
      });
    const isCreate =
      url.pathname === `/api/v1/listings/${rental.id}/inquiries` &&
      method === "POST";
    const isStudentRead = url.pathname === "/api/v1/me/inquiries";
    const isLandlordRead = url.pathname === "/api/v1/landlord/inquiries";
    const isStatus =
      /^\/api\/v1\/landlord\/inquiries\/[^/]+\/status$/.test(url.pathname) &&
      method === "PATCH";
    if (!isCreate && !isStudentRead && !isLandlordRead && !isStatus)
      return route.fallback();
    if (state.role === "GUEST") return error("SESSION_INVALID", 401);
    if (isCreate) {
      const body = request.postDataJSON() as CreateRequest;
      state.creates.push(body);
      if (state.createFailure)
        return error(state.createFailure.code, state.createFailure.status);
      let row = state.committed.get(body.clientRequestId);
      if (!row) {
        row = { ...studentRow, message: body.message };
        state.committed.set(body.clientRequestId, row);
        state.studentRows.unshift(row);
      }
      if (state.loseNextCreateResponse) {
        state.loseNextCreateResponse = false;
        return route.abort("failed");
      }
      return send({ data: row }, 201);
    }
    if (isStatus) {
      const body = request.postDataJSON() as { status: InquiryStatus };
      state.statuses.push(body.status);
      if (state.failStatus) return error("REQUEST_FAILED");
      const id = url.pathname.split("/").at(-2);
      const row = state.landlordRows.find((item) => item.id === id);
      if (!row) return error("INQUIRY_NOT_FOUND", 404);
      row.status = body.status;
      return send({ data: row });
    }
    if (state.delayRead)
      await new Promise((resolve) => setTimeout(resolve, state.delayRead));
    if (state.failRead) return error("REQUEST_FAILED");
    const rows = isStudentRead ? state.studentRows : state.landlordRows;
    const pageNumber = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 12);
    return send({
      data: rows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
      meta: {
        page: pageNumber,
        pageSize,
        total: rows.length,
        totalPages: Math.ceil(rows.length / pageSize),
      },
    });
  });
  return state;
}

async function capture(page: Page, name: string) {
  const directory = process.env.FINDME_QA_SCREENSHOTS;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  if (name.startsWith("inquiry-"))
    await page
      .locator("#rental-inquiry")
      .screenshot({ path: join(directory, `${name}.png`) });
  else
    await page.screenshot({
      path: join(directory, `${name}.png`),
      fullPage: true,
    });
}

async function sendMessage(page: Page, message = studentMessage) {
  const input = page.getByRole("textbox", { name: "Your message" });
  await expect(input).toBeEditable();
  await input.fill(message);
  const submit = page.getByRole("button", {
    name: "Send inquiry",
    exact: true,
  });
  await submit.focus();
  await page.keyboard.press("Enter");
}

test("student sends a trimmed inquiry and finds it in private sent history", async ({
  page,
}) => {
  const state = await inquiryApi(page);
  await page.goto(detailHref);
  await expect(
    page.getByRole("heading", { name: "Send an inquiry" }),
  ).toBeVisible();
  await sendMessage(page, `  ${studentMessage}  `);
  await expect(
    page.getByRole("heading", { name: "Your inquiry was sent.", exact: true }),
  ).toBeVisible();
  expect(state.creates).toEqual([
    {
      message: studentMessage,
      clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    },
  ]);
  await capture(page, "inquiry-sent");
  await page.goto("/inquiries");
  await expect(
    page.getByRole("heading", { name: "Sent inquiries", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(studentMessage, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(studentMessage, { exact: true })).toBeVisible();
  expect(state.studentRows).toHaveLength(1);
});

test("a lost response preserves the draft and retries the same committed inquiry once", async ({
  page,
}) => {
  const state = await inquiryApi(page);
  state.loseNextCreateResponse = true;
  await page.goto(detailHref);
  await sendMessage(page);
  await expect(page.getByRole("textbox", { name: "Your message" })).toHaveValue(
    studentMessage,
  );
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your inquiry was sent.", exact: true }),
  ).toBeVisible();
  expect(state.creates).toHaveLength(2);
  expect(state.creates[1]).toEqual(state.creates[0]);
  expect(state.studentRows).toHaveLength(1);
  expect(state.committed.size).toBe(1);
});

test("the form rejects empty messages and accepts the 2000 character limit", async ({
  page,
}) => {
  const state = await inquiryApi(page);
  await page.goto(detailHref);
  const input = page.getByRole("textbox", { name: "Your message" });
  const submit = page.getByRole("button", {
    name: "Send inquiry",
    exact: true,
  });
  await expect(input).toBeEditable();
  await expect(input).toHaveAttribute("maxlength", "2000");
  await submit.click();
  expect(state.creates).toHaveLength(0);
  await input.fill("   ");
  await submit.click();
  expect(state.creates).toHaveLength(0);
  const message = "ក".repeat(2000);
  await input.fill(message);
  await submit.click();
  await expect(
    page.getByRole("heading", { name: "Your inquiry was sent.", exact: true }),
  ).toBeVisible();
  expect(state.creates[0]?.message).toBe(message);
});

test("inquiry availability and rate errors preserve a useful next action", async ({
  page,
}) => {
  const state = await inquiryApi(page);
  state.createFailure = { code: "INQUIRY_RATE_LIMITED", status: 429 };
  await page.goto(detailHref);
  await sendMessage(page);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    /wait|later|limit/i,
  );
  await expect(page.getByRole("textbox", { name: "Your message" })).toHaveValue(
    studentMessage,
  );
  await capture(page, "inquiry-rate-limit");
  state.createFailure = null;
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your inquiry was sent.", exact: true }),
  ).toBeVisible();
  await page.reload();
  state.createFailure = { code: "LISTING_NOT_FOUND", status: 404 };
  await sendMessage(page);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    /unavailable|no longer/i,
  );
  expect(state.studentRows).toHaveLength(1);
});

test("student inbox preserves unavailable history and clears private data after session expiry", async ({
  page,
}) => {
  const state = await inquiryApi(page);
  state.studentRows = [{ ...studentRow, listing: null }];
  await page.goto("/inquiries");
  await expect(page.getByText(studentMessage, { exact: true })).toBeVisible();
  await expect(
    page.getByText("Rental no longer available", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: englishTitle })).toHaveCount(0);
  state.role = "GUEST";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(studentMessage, { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("landlord can retry inbox loading and advance inquiry statuses without losing failed updates", async ({
  page,
}) => {
  const state = await inquiryApi(page);
  state.role = "LANDLORD";
  state.landlordRows = [{ ...landlordRow }];
  state.delayRead = 700;
  state.failRead = true;
  await page.goto("/landlord/inquiries");
  await expect(page.getByText(/Loading.*inquiries/)).toBeVisible();
  const retry = page.getByRole("button", { name: /Retry inquiries/ });
  await expect(retry).toBeVisible();
  state.delayRead = 0;
  state.failRead = false;
  await retry.click();
  await expect(page.getByText(studentMessage, { exact: true })).toBeVisible();
  state.failStatus = true;
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  expect(state.landlordRows[0]?.status).toBe("NEW");
  state.failStatus = false;
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark as read", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mark as replied", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark as replied", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close inquiry", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Close inquiry", exact: true }),
  ).toHaveCount(0);
  expect(state.statuses).toEqual(["READ", "READ", "RESPONDED", "CLOSED"]);
  expect(state.landlordRows[0]?.status).toBe("CLOSED");
});

for (const width of [320, 390, 768, 1440]) {
  test(`inquiry form and both private inboxes reflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await inquiryApi(page);
    const message = `${khmerTitle.repeat(4)} ${"StudentMessageWithoutSpaces".repeat(10)}`;
    state.studentRows = [{ ...studentRow, message }];
    state.landlordRows = [{ ...landlordRow, message }];
    await page.goto(detailHref);
    await expect(
      page.getByRole("textbox", { name: "Your message" }),
    ).toBeEditable();
    await page.getByRole("textbox", { name: "Your message" }).fill(message);
    await capture(page, `inquiry-form-${width}`);
    for (const path of [detailHref, "/inquiries", "/landlord/inquiries"]) {
      if (path === "/landlord/inquiries") state.role = "LANDLORD";
      if (path !== detailHref) await page.goto(path);
      const control =
        path === detailHref
          ? page.getByRole("button", { name: "Send inquiry", exact: true })
          : path === "/landlord/inquiries"
            ? page.getByRole("button", { name: "Mark as read", exact: true })
            : page.getByRole("link", { name: englishTitle, exact: true });
      await expect(control).toBeVisible();
      await control.focus();
      await expect(control).toBeFocused();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width + 1);
      if (path !== detailHref)
        await capture(
          page,
          `${path === "/inquiries" ? "student" : "landlord"}-inquiries-${width}`,
        );
    }
  });
}

test("inquiry guests and account roles get clear access states without sending", async ({
  page,
}) => {
  const state = await inquiryApi(page);
  state.role = "GUEST";
  await page.goto(detailHref);
  await expect(
    page.getByRole("link", { name: "Sign in to send an inquiry" }),
  ).toHaveAttribute("href", `/login?next=%2Frentals%2F${rental.slug}`);
  state.role = "INCOMPLETE";
  await page.reload();
  await expect(
    page.getByRole("link", {
      name: "Complete your student profile to send an inquiry",
    }),
  ).toBeVisible();
  state.role = "LANDLORD";
  await page.reload();
  await expect(
    page.getByText("Only student accounts can send rental inquiries."),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your message" })).toHaveCount(
    0,
  );
  await page.goto("/inquiries");
  await expect(
    page.getByRole("heading", {
      name: "Sent inquiries are for student accounts",
    }),
  ).toBeVisible();
  state.role = "STUDENT";
  await page.goto("/landlord/inquiries");
  await expect(
    page.getByRole("heading", { name: "This inbox is for landlord accounts" }),
  ).toBeVisible();
  expect(state.creates).toHaveLength(0);
});

test("private inboxes have empty states and keyboard-friendly pagination", async ({
  page,
}) => {
  const state = await inquiryApi(page);
  await page.goto("/inquiries");
  await expect(
    page.getByRole("heading", { name: "No sent inquiries yet" }),
  ).toBeVisible();
  await capture(page, "student-inquiries-empty");
  state.studentRows = Array.from({ length: 13 }, (_, index) => ({
    ...studentRow,
    id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
    message: `Inquiry number ${index + 1}`,
  }));
  await page.getByRole("button", { name: "Refresh inbox" }).click();
  await expect(
    page.getByText("Inquiry number 1", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText("Inquiry number 13", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sent inquiries", exact: true }),
  ).toBeFocused();
  await expect(page.getByText("Inquiry number 1", { exact: true })).toHaveCount(
    0,
  );
  state.role = "LANDLORD";
  await page.goto("/landlord/inquiries");
  await expect(
    page.getByRole("heading", { name: "No student inquiries yet" }),
  ).toBeVisible();
});
