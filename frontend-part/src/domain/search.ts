import {
  getListingFreshness,
  isListingDiscoverable,
  type ListingStatus,
} from "./listing.ts";
import { rankListing } from "./ranking.ts";

export const ROOM_TYPES = [
  "private_room",
  "shared_room",
  "studio",
  "house",
] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

export const LISTING_DATA_SOURCES = ["demo", "landlord"] as const;

export type ListingDataSource = (typeof LISTING_DATA_SOURCES)[number];

export interface PublicCoordinate {
  latitude: number;
  longitude: number;
}

export interface University {
  slug: string;
  nameKm: string;
  nameEn: string;
  addressKm: string;
  addressEn: string;
  location: PublicCoordinate;
}

export interface ListingRecord {
  id: string;
  dataSource: ListingDataSource;
  titleKm: string;
  titleEn: string;
  locationContextKm: string;
  locationContextEn: string;
  roomType: RoomType;
  publicLocation: PublicCoordinate;
  baseRentUsdMinor: number;
  estimatedMonthlyUsdMinor: number;
  availableCount: number;
  capacity: number;
  amenities: readonly string[];
  status: ListingStatus;
  moderationApproved: boolean;
  confirmedAt: Date | null;
  verificationScore: number;
  completenessScore: number;
  engagementQualityScore: number;
  promoted: boolean;
}

export interface SearchFilters {
  universitySlug: string;
  maxRentUsdMinor?: number;
  maxDistanceKm?: number;
  roomType?: RoomType;
}

export interface ListingSearchResult {
  listing: ListingRecord;
  distanceKm: number;
  organicScore: number;
  explanation: readonly string[];
}

export class UniversityNotFoundError extends Error {
  constructor(slug: string) {
    super(`University '${slug}' was not found.`);
    this.name = "UniversityNotFoundError";
  }
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceInKm(
  from: PublicCoordinate,
  to: PublicCoordinate,
): number {
  const earthRadiusKm = 6_371.0088;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function freshnessScore(confirmedAt: Date | null, now: Date): number {
  const freshness = getListingFreshness(confirmedAt, now);
  if (freshness === "recent") return 1;
  if (freshness === "stale") return 0.4;
  return 0;
}

export function searchListings(
  universities: readonly University[],
  listings: readonly ListingRecord[],
  filters: SearchFilters,
  now = new Date(),
): readonly ListingSearchResult[] {
  const university = universities.find(
    (candidate) => candidate.slug === filters.universitySlug,
  );

  if (!university) throw new UniversityNotFoundError(filters.universitySlug);

  const maxDistanceKm = filters.maxDistanceKm ?? 5;
  const maxRentUsdMinor = filters.maxRentUsdMinor ?? 30_000;

  if (!Number.isFinite(maxDistanceKm) || maxDistanceKm <= 0) {
    throw new RangeError("Maximum distance must be positive.");
  }
  if (!Number.isSafeInteger(maxRentUsdMinor) || maxRentUsdMinor <= 0) {
    throw new RangeError("Maximum rent must be a positive integer.");
  }

  return listings
    .flatMap((listing): ListingSearchResult[] => {
      const distanceKm = distanceInKm(
        university.location,
        listing.publicLocation,
      );
      const matchesFilters =
        listing.availableCount > 0 &&
        distanceKm <= maxDistanceKm &&
        listing.baseRentUsdMinor <= maxRentUsdMinor &&
        (!filters.roomType || listing.roomType === filters.roomType);
      const discoverable = isListingDiscoverable(
        {
          status: listing.status,
          moderationApproved: listing.moderationApproved,
          confirmedAt: listing.confirmedAt,
        },
        now,
      );
      const ranking = rankListing({
        eligible: matchesFilters && discoverable,
        distanceKm,
        preferredDistanceKm: maxDistanceKm,
        monthlyCostMinor: listing.estimatedMonthlyUsdMinor,
        budgetMinor: maxRentUsdMinor,
        freshnessScore: freshnessScore(listing.confirmedAt, now),
        verificationScore: listing.verificationScore,
        completenessScore: listing.completenessScore,
        engagementQualityScore: listing.engagementQualityScore,
        promoted: listing.promoted,
      });

      if (!ranking.eligible || ranking.organicScore === null) return [];

      return [
        {
          listing,
          distanceKm: Math.round(distanceKm * 100) / 100,
          organicScore: ranking.organicScore,
          explanation: ranking.explanation,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.organicScore - left.organicScore ||
        left.distanceKm - right.distanceKm ||
        left.listing.id.localeCompare(right.listing.id),
    );
}
