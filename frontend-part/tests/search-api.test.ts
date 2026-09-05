import assert from "node:assert/strict";
import test from "node:test";

import {
  findInstitutionBySlug,
  PublicSearchApiError,
  searchInstitutions,
  searchPublishedListings,
} from "../src/features/search/search-api.ts";

const institution = {
  id: "4f981334-aed1-4f56-bc64-35c51c563906",
  slug: "royal-university-of-phnom-penh",
  nameKm: "សាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ",
  nameEn: "Royal University of Phnom Penh",
  shortName: "RUPP",
  type: "UNIVERSITY",
  city: "Phnom Penh",
  latitude: 11.5683,
  longitude: 104.8907,
} as const;

test("institution search sends normalized bilingual queries without browser caching", async () => {
  const previousFetch = globalThis.fetch;
  const requests: Array<{ url: string; cache: RequestCache | undefined }> = [];
  globalThis.fetch = (async (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ) => {
    requests.push({ url: String(input), cache: init?.cache });
    return Response.json({
      data: [institution],
      meta: {
        count: 1,
        query: "សាកលវិទ្យាល័យ",
        selectedSlug: null,
        limit: 12,
      },
    });
  }) as typeof fetch;

  try {
    const page = await searchInstitutions({
      query: "  សាកលវិទ្យាល័យ  ",
      limit: 12,
    });
    assert.equal(page.data[0]?.nameEn, institution.nameEn);
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(requests[0]?.cache, "no-store");
  const url = new URL(requests[0]?.url ?? "");
  assert.equal(url.pathname, "/api/v1/institutions");
  assert.equal(url.searchParams.get("query"), "សាកលវិទ្យាល័យ");
  assert.equal(url.searchParams.get("limit"), "12");
});

test("institution selection resolves a canonical active slug", async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input: string | URL | globalThis.Request) => {
    requestedUrl = String(input);
    return Response.json({
      data: [institution],
      meta: {
        count: 1,
        query: null,
        selectedSlug: institution.slug,
        limit: 1,
      },
    });
  }) as typeof fetch;

  try {
    const selected = await findInstitutionBySlug(institution.slug);
    assert.equal(selected?.id, institution.id);
  } finally {
    globalThis.fetch = previousFetch;
  }

  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.get("slug"), institution.slug);
  assert.equal(url.searchParams.get("limit"), "1");
});

test("institution search rejects malformed runtime responses", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      data: [{ id: "unsafe-partial-record" }],
      meta: {},
    })) as typeof fetch;

  try {
    await assert.rejects(
      () => searchInstitutions(),
      (error: unknown) =>
        error instanceof PublicSearchApiError &&
        error.code === "PUBLIC_SEARCH_RESPONSE_INVALID",
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("public search requests current published inventory with normalized filters", async () => {
  const previousFetch = globalThis.fetch;
  const requests: Array<{ url: string; cache: RequestCache | undefined }> = [];
  globalThis.fetch = (async (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ) => {
    requests.push({ url: String(input), cache: init?.cache });
    return Response.json({
      data: [],
      meta: {
        page: 2,
        pageSize: 15,
        total: 0,
        totalPages: 0,
        institution,
        radiusMeters: 3_000,
        viewport: {
          north: 11.59,
          south: 11.55,
          east: 104.92,
          west: 104.87,
        },
        filters: {
          minPrice: 70,
          maxPrice: 150,
          currency: "USD",
          propertyTypes: ["ROOM", "STUDIO"],
          amenities: ["wifi", "desk"],
          availableBy: "2026-09-10",
        },
        sort: "price_desc",
        refreshedAt: "2026-09-04T00:00:00.000Z",
        cacheGeneration: "4",
      },
    });
  }) as typeof fetch;

  try {
    await searchPublishedListings({
      institutionId: institution.id,
      radiusMeters: 3_000,
      minPrice: 70,
      maxPrice: 150,
      currency: "USD",
      propertyTypes: ["ROOM", "STUDIO"],
      amenities: ["wifi", "desk"],
      availableBy: "2026-09-10",
      viewport: {
        north: 11.59,
        south: 11.55,
        east: 104.92,
        west: 104.87,
      },
      sort: "price_desc",
      page: 2,
      pageSize: 15,
    });
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(requests[0]?.cache, "no-store");
  const searchUrl = new URL(requests[0]?.url ?? "");
  assert.equal(searchUrl.pathname, "/api/v1/listings/search");
  assert.equal(searchUrl.searchParams.get("institutionId"), institution.id);
  assert.equal(searchUrl.searchParams.get("radiusMeters"), "3000");
  assert.equal(searchUrl.searchParams.get("minPrice"), "70");
  assert.equal(searchUrl.searchParams.get("maxPrice"), "150");
  assert.equal(searchUrl.searchParams.get("currency"), "USD");
  assert.equal(searchUrl.searchParams.get("propertyTypes"), "ROOM,STUDIO");
  assert.equal(searchUrl.searchParams.get("amenities"), "wifi,desk");
  assert.equal(searchUrl.searchParams.get("availableBy"), "2026-09-10");
  assert.equal(searchUrl.searchParams.get("north"), "11.59");
  assert.equal(searchUrl.searchParams.get("south"), "11.55");
  assert.equal(searchUrl.searchParams.get("east"), "104.92");
  assert.equal(searchUrl.searchParams.get("west"), "104.87");
  assert.equal(searchUrl.searchParams.get("sort"), "price_desc");
  assert.equal(searchUrl.searchParams.get("page"), "2");
  assert.equal(searchUrl.searchParams.get("pageSize"), "15");
});

test("public search rejects malformed successful responses", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({ data: [], meta: { page: 1 } })) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        searchPublishedListings({
          institutionId: institution.id,
          radiusMeters: 5_000,
        }),
      (error: unknown) =>
        error instanceof PublicSearchApiError &&
        error.code === "PUBLIC_SEARCH_RESPONSE_INVALID",
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("public search exposes stable API errors", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json(
      { error: { code: "INSTITUTION_NOT_FOUND", message: "Missing school" } },
      { status: 404 },
    )) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        searchPublishedListings({
          institutionId: institution.id,
          radiusMeters: 5_000,
        }),
      (error: unknown) =>
        error instanceof PublicSearchApiError &&
        error.code === "INSTITUTION_NOT_FOUND" &&
        error.message === "Missing school",
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
