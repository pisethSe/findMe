import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInstitutionSearchHref,
  institutionInputValue,
  institutionTypeLabel,
  nextInstitutionOptionIndex,
} from "../src/features/search/institution-search-model.ts";

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

test("institution picker keeps a stable readable input value and type label", () => {
  assert.equal(institutionInputValue(institution), institution.nameEn);
  assert.equal(institutionTypeLabel(institution.type), "University");
  assert.equal(institutionTypeLabel("OTHER"), "Educational institution");
});

test("institution picker keyboard navigation wraps in both directions", () => {
  assert.equal(nextInstitutionOptionIndex(-1, 3, "next"), 0);
  assert.equal(nextInstitutionOptionIndex(2, 3, "next"), 0);
  assert.equal(nextInstitutionOptionIndex(0, 3, "previous"), 2);
  assert.equal(nextInstitutionOptionIndex(-1, 0, "next"), -1);
});

test("selected institution persists canonically while preserving filters", () => {
  const href = buildInstitutionSearchHref(
    "?university=legacy&page=3&maxRentUsd=140&propertyType=ROOM&north=11.6&south=11.5&east=105&west=104.8",
    institution.slug,
  );
  const url = new URL(href, "https://findme.test");

  assert.equal(url.pathname, "/search");
  assert.equal(url.searchParams.get("institution"), institution.slug);
  assert.equal(url.searchParams.get("university"), null);
  assert.equal(url.searchParams.get("page"), null);
  assert.equal(url.searchParams.get("north"), null);
  assert.equal(url.searchParams.get("south"), null);
  assert.equal(url.searchParams.get("east"), null);
  assert.equal(url.searchParams.get("west"), null);
  assert.equal(url.searchParams.get("maxRentUsd"), "140");
  assert.equal(url.searchParams.get("propertyType"), "ROOM");
});
