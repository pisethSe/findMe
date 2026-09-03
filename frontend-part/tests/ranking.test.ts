import assert from "node:assert/strict";
import test from "node:test";

import { rankListing, type RankingSignals } from "../src/domain/ranking.ts";

const BASE_SIGNALS: RankingSignals = {
  eligible: true,
  distanceKm: 1,
  preferredDistanceKm: 3,
  monthlyCostMinor: 8_000,
  budgetMinor: 10_000,
  freshnessScore: 1,
  verificationScore: 0.75,
  completenessScore: 0.9,
  engagementQualityScore: 0.5,
  promoted: false,
};

test("ranks an eligible listing with an explainable score", () => {
  const result = rankListing(BASE_SIGNALS);

  assert.equal(result.eligible, true);
  assert.equal(result.organicScore, 0.8905);
  assert.match(result.explanation[0] ?? "", /University distance/);
});

test("promotion does not alter organic relevance", () => {
  const organic = rankListing(BASE_SIGNALS);
  const promoted = rankListing({ ...BASE_SIGNALS, promoted: true });

  assert.equal(promoted.organicScore, organic.organicScore);
  assert.equal(promoted.promoted, true);
});

test("promotion cannot make an ineligible listing rank", () => {
  const result = rankListing({
    ...BASE_SIGNALS,
    eligible: false,
    promoted: true,
  });

  assert.equal(result.eligible, false);
  assert.equal(result.organicScore, null);
});
