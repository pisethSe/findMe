import type { PropertyType } from "@findme/contracts";
import type { Metadata } from "next";

import { PublishedRentalSearch } from "../../features/search/published-rental-search";

export const metadata: Metadata = {
  title: "Browse nearby rentals",
  robots: { index: false, follow: false },
};

const PROPERTY_TYPES = new Set<PropertyType>([
  "ROOM",
  "STUDIO",
  "APARTMENT",
  "HOUSE",
  "DORM_ROOM",
  "OTHER_STUDENT_RENTAL",
]);
const DEFAULT_INSTITUTION_SLUG = "royal-university-of-phnom-penh";
const INSTITUTION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseBoundedPositive(
  value: string | undefined,
  maximum: number,
): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : undefined;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const institutionSlug =
    firstValue(params.institution) ??
    firstValue(params.university) ??
    DEFAULT_INSTITUTION_SLUG;
  const validInstitutionSlug =
    institutionSlug.length <= 160 &&
    INSTITUTION_SLUG_PATTERN.test(institutionSlug);
  const requestedPropertyType = firstValue(params.propertyType);
  const propertyType = PROPERTY_TYPES.has(requestedPropertyType as PropertyType)
    ? (requestedPropertyType as PropertyType)
    : undefined;
  const requestedMaxRent = firstValue(params.maxRentUsd);
  const requestedMaxDistance = firstValue(params.maxDistanceKm);
  const parsedMaxRent = parseBoundedPositive(
    requestedMaxRent,
    9_999_999_999.99,
  );
  const parsedMaxDistance = parseBoundedPositive(requestedMaxDistance, 20);
  const invalidFilters =
    !validInstitutionSlug ||
    (requestedPropertyType !== undefined &&
      requestedPropertyType !== "" &&
      propertyType === undefined) ||
    (requestedMaxRent !== undefined && parsedMaxRent === undefined) ||
    (requestedMaxDistance !== undefined && parsedMaxDistance === undefined);

  return (
    <PublishedRentalSearch
      institutionSlug={
        validInstitutionSlug ? institutionSlug : DEFAULT_INSTITUTION_SLUG
      }
      maxRentUsd={parsedMaxRent ?? 300}
      maxDistanceKm={parsedMaxDistance ?? 5}
      {...(propertyType ? { propertyType } : {})}
      invalidFilters={invalidFilters}
    />
  );
}
