import {
  ROOM_TYPES,
  type RoomType,
  type SearchFilters,
} from "../domain/search.ts";

export class InvalidSearchQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSearchQueryError";
  }
}

function parsePositiveNumber(
  value: string | null,
  label: string,
): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidSearchQueryError(`${label} must be a positive number.`);
  }
  return parsed;
}

function parseRoomType(value: string | null): RoomType | undefined {
  if (value === null) return undefined;
  if (!ROOM_TYPES.includes(value as RoomType)) {
    throw new InvalidSearchQueryError("Room type is not supported.");
  }
  return value as RoomType;
}

export function parseSearchQuery(url: URL): SearchFilters {
  const universitySlug = url.searchParams.get("university")?.trim();
  if (!universitySlug) {
    throw new InvalidSearchQueryError("University is required.");
  }

  const maxRentUsd = parsePositiveNumber(
    url.searchParams.get("maxRentUsd"),
    "Maximum rent",
  );
  const maxDistanceKm = parsePositiveNumber(
    url.searchParams.get("maxDistanceKm"),
    "Maximum distance",
  );
  const roomType = parseRoomType(url.searchParams.get("roomType"));

  return {
    universitySlug,
    ...(maxRentUsd === undefined
      ? {}
      : { maxRentUsdMinor: Math.round(maxRentUsd * 100) }),
    ...(maxDistanceKm === undefined ? {} : { maxDistanceKm }),
    ...(roomType === undefined ? {} : { roomType }),
  };
}
