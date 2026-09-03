function clampScore(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError("Score must be finite.");
  return Math.min(1, Math.max(0, value));
}

export interface RankingSignals {
  eligible: boolean;
  distanceKm: number;
  preferredDistanceKm: number;
  monthlyCostMinor: number;
  budgetMinor: number;
  freshnessScore: number;
  verificationScore: number;
  completenessScore: number;
  engagementQualityScore: number;
  promoted: boolean;
}

export interface RankingResult {
  eligible: boolean;
  organicScore: number | null;
  promoted: boolean;
  explanation: readonly string[];
}

/** Paid promotion is returned only as a label; it never changes organic score. */
export function rankListing(signals: RankingSignals): RankingResult {
  if (!signals.eligible) {
    return {
      eligible: false,
      organicScore: null,
      promoted: signals.promoted,
      explanation: [
        "Listing did not pass relevance, safety, or freshness gates.",
      ],
    };
  }

  if (signals.preferredDistanceKm <= 0 || signals.budgetMinor <= 0) {
    throw new RangeError("Distance preference and budget must be positive.");
  }
  if (signals.distanceKm < 0 || signals.monthlyCostMinor < 0) {
    throw new RangeError("Distance and monthly cost cannot be negative.");
  }

  const distanceScore = clampScore(
    1 - signals.distanceKm / (signals.preferredDistanceKm * 2),
  );
  const budgetScore =
    signals.monthlyCostMinor <= signals.budgetMinor
      ? 1
      : clampScore(
          1 -
            (signals.monthlyCostMinor - signals.budgetMinor) /
              signals.budgetMinor,
        );

  const components = {
    distance: distanceScore * 0.3,
    budget: budgetScore * 0.25,
    freshness: clampScore(signals.freshnessScore) * 0.2,
    verification: clampScore(signals.verificationScore) * 0.15,
    completeness: clampScore(signals.completenessScore) * 0.07,
    engagement: clampScore(signals.engagementQualityScore) * 0.03,
  };

  const organicScore = Object.values(components).reduce(
    (sum, component) => sum + component,
    0,
  );

  return {
    eligible: true,
    organicScore: Math.round(organicScore * 10_000) / 10_000,
    promoted: signals.promoted,
    explanation: [
      `University distance: ${Math.round(distanceScore * 100)}% match`,
      `Budget: ${Math.round(budgetScore * 100)}% match`,
      `Availability freshness: ${Math.round(clampScore(signals.freshnessScore) * 100)}%`,
      `Verification: ${Math.round(clampScore(signals.verificationScore) * 100)}%`,
    ],
  };
}
