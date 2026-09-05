import assert from "node:assert/strict";
import test from "node:test";

import { PublicCacheService } from "../dist/modules/public-cache/public-cache.service.js";

test("public search cache versions search keys and invalidates listing keys", async () => {
  const values = new Map([["findme:v1:public-search:generation", "7"]]);
  const deletions = [];
  const fakeClient = {
    isOpen: true,
    isReady: true,
    get: async (key) => values.get(key) ?? null,
    set: async (key, value, options) => {
      assert.deepEqual(options, { expiration: { type: "EX", value: 30 } });
      values.set(key, value);
      return "OK";
    },
    multi() {
      return {
        incr(key) {
          values.set(key, String(Number(values.get(key) ?? "0") + 1));
          return this;
        },
        del(keys) {
          deletions.push(...keys);
          return this;
        },
        async exec() {
          return [];
        },
      };
    },
    destroy() {},
  };
  const cache = new PublicCacheService();
  cache.getClient = async () => fakeClient;
  const fingerprint = { institutionId: "one", radiusMeters: 5_000 };

  const miss = await cache.getSearch(fingerprint);
  assert.equal(miss.generation, "7");
  assert.equal(miss.value, null);
  await cache.setSearch("7", fingerprint, { data: ["listing"] });
  const hit = await cache.getSearch(fingerprint);
  assert.deepEqual(hit.value, { data: ["listing"] });

  await cache.invalidatePublishedListing({
    id: "listing-id",
    slug: "listing-slug",
  });
  assert.equal(values.get("findme:v1:public-search:generation"), "8");
  assert.deepEqual(deletions, [
    "findme:v1:public-listing:id:listing-id",
    "findme:v1:public-listing:slug:listing-slug",
  ]);

  await cache.invalidatePublishedListings([
    { id: "listing-two", slug: "listing-two-slug" },
    { id: "listing-three", slug: "listing-three-slug" },
  ]);
  assert.equal(values.get("findme:v1:public-search:generation"), "9");
  assert.deepEqual(deletions.slice(2), [
    "findme:v1:public-listing:id:listing-two",
    "findme:v1:public-listing:slug:listing-two-slug",
    "findme:v1:public-listing:id:listing-three",
    "findme:v1:public-listing:slug:listing-three-slug",
  ]);
});

test("public cache safely bypasses Redis when it is not configured", async () => {
  const cache = new PublicCacheService();
  assert.deepEqual(await cache.getSearch({ query: "safe" }), {
    generation: null,
    value: null,
  });
  await cache.setSearch(null, { query: "safe" }, { data: [] });
  await cache.invalidatePublishedListing({ id: "one", slug: "one" });
  await cache.invalidatePublishedListings([]);
});
