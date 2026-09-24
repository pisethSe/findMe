import { expect, test } from "@playwright/test";
import { onboarding, supplyApi } from "./supply-fixtures";

test("registration validates confirmation, offers only the approved roles in the selected language, and returns a student to discovery", async ({
  page,
}) => {
  const state = await supplyApi(page);
  state.signedIn = false;
  state.onboarding = onboarding(null);
  await page.goto("/register?next=%2Fsearch%3FmaxRentUsd%3D150");
  await page.getByLabel("Email address").fill("student@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("student-password-123");
  await page.getByLabel("Confirm password").fill("different-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "passwords do not match",
  );
  expect(state.writes).toHaveLength(0);
  await page.getByLabel("Confirm password").fill("student-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/onboarding\/role\?next=/);
  await expect(
    page.getByRole("heading", {
      name: "Are you a student or a landlord?",
    }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Choose a role to continue" }),
  ).toBeDisabled();
  const student = page.getByRole("radio", { name: /^Student/ });
  await student.focus();
  await page.keyboard.press("Space");
  await expect(student).toBeChecked();
  await page.getByLabel("Your display name").fill("សុភា");
  await page.getByRole("button", { name: "Continue as student" }).click();
  await expect(page).toHaveURL(/\/search\?maxRentUsd=150$/);
  expect(state.writes.map(({ path, body }) => ({ path, body }))).toEqual([
    {
      path: "/auth/register",
      body: {
        email: "student@example.test",
        password: "student-password-123",
        preferredLocale: "KM",
      },
    },
    {
      path: "/me/onboarding/role",
      body: { role: "STUDENT", displayName: "សុភា" },
    },
  ]);
});

test("sign-in pages offer Google sign-in only when the server supports it", async ({
  page,
}) => {
  const state = await supplyApi(page);
  state.signedIn = false;

  state.googleProvider = true;
  await page.goto("/login");
  await expect(page.getByLabel("Email address")).toBeVisible();
  const enabled = page.getByTestId("google-signin");
  await expect(enabled).toBeVisible();
  await expect(enabled).toHaveAttribute("href", /\/auth\/google\/start/);
  await expect(page.getByText("Or continue with email")).toBeVisible();

  state.googleProvider = false;
  await page.goto("/register");
  await expect(page.getByLabel("Email address")).toBeVisible();
  const disabled = page.getByTestId("google-signin");
  await expect(disabled).toBeVisible();
  await expect(disabled).toBeDisabled();
  await expect(
    page.getByText(
      "Google sign-in is not set up on this server yet. Use email and password instead.",
    ),
  ).toBeVisible();
});

test("first-time landlord activation continues to the rental wizard and returning visits skip onboarding", async ({
  page,
}) => {
  const state = await supplyApi(page);
  state.onboarding = onboarding(null);
  await page.goto("/onboarding/role");
  await page.getByRole("radio", { name: /^Landlord/ }).check();
  await page.getByRole("button", { name: "Continue as landlord" }).click();
  await expect(page).toHaveURL(/\/onboarding\/landlord$/);
  await page.getByLabel("Your name", { exact: true }).fill("Rental owner");
  await page.getByLabel("Contact phone").fill("012345678");
  await page
    .getByRole("button", { name: "Complete profile and start trial" })
    .click();
  await expect(page).toHaveURL(/\/landlord\/listings\/new$/);
  await expect(
    page.getByLabel("Property or rental name", { exact: true }),
  ).toBeVisible();
  expect(
    state.writes.find(({ path }) => path === "/landlord/onboarding")?.body,
  ).toEqual({ displayName: "Rental owner", contactPhone: "012345678" });
  await page.goto("/onboarding/landlord");
  await expect(page).toHaveURL(/\/landlord$/);
  await expect(
    page.getByRole("heading", { name: "No rentals yet" }),
  ).toBeVisible();
  expect(
    state.writes.filter(({ path }) => path === "/landlord/onboarding"),
  ).toHaveLength(1);
});

for (const role of ["STUDENT", "LANDLORD"] as const) {
  test(`returning ${role} uses server routing and rejects an external return URL`, async ({
    page,
  }) => {
    const state = await supplyApi(page);
    state.signedIn = false;
    state.onboarding = onboarding(role);
    state.failLogin = true;
    await page.goto("/login?next=https%3A%2F%2Funtrusted.example%2Fadmin");
    await page.getByLabel("Email address").fill("returning@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("student-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Please try again.",
    );
    state.failLogin = false;
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${state.onboarding.nextPath}$`));
    expect(new URL(page.url()).origin).toBe("http://127.0.0.1:3100");
    await page.goto("/onboarding/role?role=ADMIN");
    await expect(page).toHaveURL(new RegExp(`${state.onboarding.nextPath}$`));
    expect(
      state.writes.filter(({ path }) => path.includes("onboarding")),
    ).toHaveLength(0);
  });
}

test("unauthenticated and student visitors cannot open the landlord form", async ({
  page,
}) => {
  const state = await supplyApi(page);
  state.signedIn = false;
  await page.goto("/landlord/listings/new");
  await expect(page).toHaveURL(/\/login$/);
  state.signedIn = true;
  state.onboarding = onboarding("STUDENT");
  await page.goto("/landlord/listings/new");
  await expect(page).toHaveURL(/\/$/);
  expect(state.writes).toHaveLength(0);
});
