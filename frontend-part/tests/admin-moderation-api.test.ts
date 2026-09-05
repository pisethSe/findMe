import assert from "node:assert/strict";
import test from "node:test";

import { clearAccessToken } from "../src/features/auth/auth-api.ts";
import {
  approveListing,
  listPendingListings,
  rejectListing,
} from "../src/features/admin/admin-moderation-api.ts";

const refreshPayload = {
  data: {
    accessToken: "moderation-test-token",
    accessTokenExpiresInSeconds: 600,
    user: {
      id: "00000000-0000-4000-8000-000000000010",
      email: "admin@example.test",
      role: "ADMIN",
      preferredLocale: "EN",
      onboardingComplete: true,
    },
  },
};

test("moderation reads every explicit queue page", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
    clearAccessToken();
  });
  clearAccessToken();
  const calls: Array<{ url: string; authorization: string | null }> = [];
  globalThis.fetch = async (input, init) => {
    const url = input.toString();
    calls.push({
      url,
      authorization: new Headers(init?.headers).get("authorization"),
    });
    if (url.endsWith("/auth/refresh")) return jsonResponse(refreshPayload);
    return jsonResponse({
      data: [],
      meta: { page: 2, pageSize: 20, total: 45, totalPages: 3 },
    });
  };

  const page = await listPendingListings(2, 20);

  assert.match(
    calls[1]?.url ?? "",
    /admin\/listings\/pending\?page=2&pageSize=20$/,
  );
  assert.equal(calls[1]?.authorization, "Bearer moderation-test-token");
  assert.deepEqual(page.meta, {
    page: 2,
    pageSize: 20,
    total: 45,
    totalPages: 3,
  });
});

test("moderation decisions use only the named Admin commands", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
    clearAccessToken();
  });
  clearAccessToken();
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  globalThis.fetch = async (input, init) => {
    const url = input.toString();
    if (url.endsWith("/auth/refresh")) return jsonResponse(refreshPayload);
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : null,
    });
    return jsonResponse({ data: { id: "listing-id" } });
  };

  await approveListing("listing-one");
  await rejectListing("listing-two", "Replace the unclear room photo.");

  assert.deepEqual(
    calls.map(({ url, method }) => [url.replace(/^.*\/api\/v1/, ""), method]),
    [
      ["/admin/listings/listing-one/approve", "POST"],
      ["/admin/listings/listing-two/reject", "POST"],
    ],
  );
  assert.equal(calls[0]?.body, JSON.stringify({}));
  assert.equal(
    calls[1]?.body,
    JSON.stringify({ moderationNote: "Replace the unclear room photo." }),
  );
});

function jsonResponse(payload: object): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
