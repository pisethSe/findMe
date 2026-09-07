import assert from "node:assert/strict";
import test from "node:test";

import {
  getRentalDetail,
  isRentalDetail,
} from "../src/features/rentals/rental-detail-api.ts";
import {
  phoneHref,
  rentalAvailability,
  rentalCanonicalUrl,
  rentalDetailHref,
  rentalMoney,
  rentalTitle,
  searchReturnHref,
  telegramHref,
} from "../src/features/rentals/rental-detail-model.ts";
import { publicRental } from "./fixtures/public-rental.ts";

test("rental links preserve the institution and complete internal search context", () => {
  const search =
    "institution=rupp&maxDistanceKm=1.001&maxRentUsd=150&propertyType=ROOM&page=2&north=11.59&south=11.55&east=104.92&west=104.87";
  const href = new URL(
    rentalDetailHref(publicRental.slug, "rupp", search),
    "https://findme.invalid",
  );
  assert.equal(href.pathname, "/rentals/room-near-rupp");
  assert.equal(href.searchParams.get("institution"), "rupp");
  assert.equal(href.searchParams.get("returnTo"), `/search?${search}`);
  assert.equal(
    searchReturnHref(href.searchParams.get("returnTo")),
    `/search?${search}`,
  );
  for (const unsafe of [
    "https://evil.test",
    "//evil.test/search",
    "/search/../admin",
    "/searching",
    "/search#bad",
    "/search\\evil.test",
    "javascript:alert(1)",
    ["/search"],
    "/search?" + "a".repeat(4096),
  ])
    assert.equal(searchReturnHref(unsafe), "/search");
});

test("canonical rental URLs omit search context and require an explicit safe public origin", () => {
  assert.equal(rentalCanonicalUrl("room-near-rupp", undefined), undefined);
  assert.equal(
    rentalCanonicalUrl("room-near-rupp", "https://findme.example"),
    "https://findme.example/rentals/room-near-rupp",
  );
  for (const invalid of [
    "javascript:foo",
    "https://secret@findme.example",
    "https://findme.example/path",
    "https://findme.example?search=x",
    "not a URL",
  ])
    assert.throws(() => rentalCanonicalUrl("room", invalid));
});

test("detail copy preserves zero deposits, Khmer fallback, and Cambodia availability dates", () => {
  assert.equal(rentalMoney(0, "USD"), "$0.00");
  assert.equal(
    rentalTitle({ titleEn: null, titleKm: "បន្ទប់ជួល" }),
    "បន្ទប់ជួល",
  );
  const now = new Date("2026-09-05T18:00:00Z");
  assert.equal(rentalAvailability("2026-09-06", now), "Available now");
  assert.equal(
    rentalAvailability("2026-09-07", now),
    "Available from 7 Sept 2026",
  );
  assert.equal(rentalAvailability(null, now), "Available now");
});

test("contact actions use only safe phone numbers and Telegram usernames", () => {
  assert.equal(phoneHref("+855 12-345-678"), "tel:+85512345678");
  assert.equal(telegramHref("@owner_123"), "https://t.me/owner_123");
  for (const unsafe of [
    null,
    "javascript:alert(1)",
    "https://evil.test",
    "bad/name?url=evil",
    "<script>",
  ]) {
    assert.equal(phoneHref(unsafe), null);
    assert.equal(telegramHref(unsafe), null);
  }
});

test("rental runtime validation rejects broken detail fields and disallowed contact leakage", () => {
  assert.equal(isRentalDetail(publicRental), true);
  for (const change of [
    { depositAmount: -1 },
    { bedrooms: 1.5 },
    { bathrooms: "1" },
    { availableUnits: 0 },
    { updatedAt: "invalid" },
    { images: null },
    { descriptionKm: undefined },
    { distanceMeters: 100 },
    { institution: { id: "partial" } },
    { location: { city: "Phnom Penh" } },
    {
      images: [{ ...publicRental.images[0], publicUrl: "javascript:alert(1)" }],
    },
    { contact: { ...publicRental.contact, phone: "+85512345678" } },
    { contact: { ...publicRental.contact, telegram: "private_name" } },
    { contact: { ...publicRental.contact, preference: "ADMIN" } },
  ])
    assert.equal(
      isRentalDetail({ ...publicRental, ...change }),
      false,
      JSON.stringify(change),
    );
});

test("public detail fetches are uncached, bounded, and distinguish missing rentals from service failures", async () => {
  const originalFetch = globalThis.fetch;
  let status = 200;
  let payload: unknown = { data: publicRental };
  let requested = "";
  let options: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => {
    requested = String(input);
    options = init;
    return Response.json(payload, { status });
  }) as typeof fetch;
  try {
    assert.deepEqual(
      await getRentalDetail(publicRental.slug, "school-id"),
      publicRental,
    );
    assert.equal(
      new URL(requested).pathname,
      "/api/v1/listings/room-near-rupp",
    );
    assert.equal(
      new URL(requested).searchParams.get("institutionId"),
      "school-id",
    );
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal);
    status = 404;
    payload = { error: { code: "LISTING_NOT_FOUND" } };
    assert.equal(await getRentalDetail(publicRental.slug), null);
    payload = { error: { code: "INSTITUTION_NOT_FOUND" } };
    await assert.rejects(
      () => getRentalDetail(publicRental.slug),
      /institution is unavailable/,
    );
    status = 500;
    payload = { error: { message: "INTERNAL SECRET" } };
    await assert.rejects(
      () => getRentalDetail(publicRental.slug),
      /could not load this rental/,
    );
    status = 200;
    payload = { data: { id: "partial" } };
    await assert.rejects(
      () => getRentalDetail(publicRental.slug),
      /invalid rental response/,
    );
    requested = "";
    assert.equal(await getRentalDetail("../landlord"), null);
    assert.equal(requested, "");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
