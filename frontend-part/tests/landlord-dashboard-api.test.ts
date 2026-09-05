import assert from "node:assert/strict";
import test from "node:test";

import { clearAccessToken } from "../src/features/auth/auth-api.ts";
import {
  listLandlordListings,
  listRecentLandlordInquiries,
  runListingCommand,
  updateListingAvailability,
} from "../src/features/landlord/landlord-dashboard-api.ts";

const refreshPayload = {
  data: {
    accessToken: "dashboard-test-token",
    accessTokenExpiresInSeconds: 600,
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      email: "landlord@example.test",
      role: "LANDLORD",
      preferredLocale: "EN",
      onboardingComplete: true,
    },
  },
};

test("dashboard reads use the paginated owned-listing and inquiry endpoints", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
    clearAccessToken();
  });
  clearAccessToken();
  const calls: Array<{
    url: string;
    method: string;
    authorization: string | null;
  }> = [];
  globalThis.fetch = async (input, init) => {
    const url = input.toString();
    calls.push({
      url,
      method: init?.method ?? "GET",
      authorization: new Headers(init?.headers).get("authorization"),
    });
    if (url.endsWith("/auth/refresh")) return jsonResponse(refreshPayload);
    return jsonResponse({
      data: [],
      meta: { page: 1, pageSize: 6, total: 0, totalPages: 0 },
    });
  };

  await listLandlordListings(1, 6);
  await listRecentLandlordInquiries(5);

  assert.match(calls[1]?.url ?? "", /landlord\/listings\?page=1&pageSize=6$/);
  assert.match(calls[2]?.url ?? "", /landlord\/inquiries\?page=1&pageSize=5$/);
  assert.equal(calls[1]?.authorization, "Bearer dashboard-test-token");
  assert.equal(calls[2]?.authorization, "Bearer dashboard-test-token");
});

test("dashboard writes call only named availability and lifecycle commands", async (context) => {
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

  await updateListingAvailability("listing-id", 2);
  await runListingCommand("listing-id", "SUBMIT");
  await runListingCommand("listing-id", "PAUSE");
  await runListingCommand("listing-id", "MARK_RENTED");
  await runListingCommand("listing-id", "ARCHIVE");

  assert.deepEqual(
    calls.map(({ url, method }) => [url.replace(/^.*\/api\/v1/, ""), method]),
    [
      ["/landlord/listings/listing-id/availability", "PATCH"],
      ["/landlord/listings/listing-id/submit", "POST"],
      ["/landlord/listings/listing-id/pause", "POST"],
      ["/landlord/listings/listing-id/mark-rented", "POST"],
      ["/landlord/listings/listing-id", "DELETE"],
    ],
  );
  assert.equal(calls[0]?.body, JSON.stringify({ availableUnits: 2 }));
});

function jsonResponse(payload: object): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
