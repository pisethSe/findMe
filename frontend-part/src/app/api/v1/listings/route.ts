import { NextResponse } from "next/server";

import {
  createDemoListings,
  DEMO_UNIVERSITIES,
} from "../../../../data/demo.ts";
import {
  searchListings,
  UniversityNotFoundError,
} from "../../../../domain/search.ts";
import {
  InvalidSearchQueryError,
  parseSearchQuery,
} from "../../../../server/search-query.ts";

export const dynamic = "force-dynamic";

export function GET(request: Request): NextResponse {
  try {
    const now = new Date();
    const filters = parseSearchQuery(new URL(request.url));
    const results = searchListings(
      DEMO_UNIVERSITIES,
      createDemoListings(now),
      filters,
      now,
    );

    return NextResponse.json({
      data: results.map((result) => ({
        id: result.listing.id,
        dataSource: result.listing.dataSource,
        title: {
          km: result.listing.titleKm,
          en: result.listing.titleEn,
        },
        roomType: result.listing.roomType,
        locationContext: {
          km: result.listing.locationContextKm,
          en: result.listing.locationContextEn,
        },
        publicLocation: result.listing.publicLocation,
        baseRent: {
          amountMinor: result.listing.baseRentUsdMinor,
          currency: "USD",
        },
        estimatedMonthlyCost: {
          amountMinor: result.listing.estimatedMonthlyUsdMinor,
          currency: "USD",
        },
        availableCount: result.listing.availableCount,
        capacity: result.listing.capacity,
        amenities: result.listing.amenities,
        confirmedAt: result.listing.confirmedAt,
        distanceKm: result.distanceKm,
        verificationScore: result.listing.verificationScore,
        promoted: result.listing.promoted,
        organicScore: result.organicScore,
        rankingExplanation: result.explanation,
      })),
      meta: {
        demo: true,
        count: results.length,
        filters,
        disclaimer:
          "Demonstration records only. They are not live rental advertisements.",
      },
    });
  } catch (error) {
    if (
      error instanceof InvalidSearchQueryError ||
      error instanceof UniversityNotFoundError ||
      error instanceof RangeError
    ) {
      return NextResponse.json(
        {
          error: {
            code:
              error instanceof UniversityNotFoundError
                ? "UNIVERSITY_NOT_FOUND"
                : "INVALID_SEARCH_QUERY",
            message: error.message,
          },
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
