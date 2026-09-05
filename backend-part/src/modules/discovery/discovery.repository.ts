import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import { PublicListingSort } from "./dto/search-public-listings.dto.js";
import type {
  InstitutionRecord,
  NormalizedPublicSearchInput,
  PublicSearchRecord,
} from "./discovery.types.js";

const institutionSelect = {
  id: true,
  slug: true,
  nameKm: true,
  nameEn: true,
  shortName: true,
  type: true,
  city: true,
  latitude: true,
  longitude: true,
} as const;

@Injectable()
export class DiscoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  listInstitutions(input: {
    q?: string;
    slug?: string;
    limit: number;
  }): Promise<InstitutionRecord[]> {
    return this.prisma.institution.findMany({
      where: {
        isActive: true,
        ...(input.slug ? { slug: input.slug } : {}),
        ...(input.q
          ? {
              OR: [
                { nameKm: { contains: input.q, mode: "insensitive" } },
                { nameEn: { contains: input.q, mode: "insensitive" } },
                { shortName: { contains: input.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: institutionSelect,
      orderBy: [{ nameEn: "asc" }, { id: "asc" }],
      take: input.limit,
    });
  }

  findInstitution(institutionId: string): Promise<InstitutionRecord | null> {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, isActive: true },
      select: institutionSelect,
    });
  }

  async search(
    input: NormalizedPublicSearchInput,
  ): Promise<{ records: PublicSearchRecord[]; total: number }> {
    const filters = searchFilters(input);
    const orderBy = searchOrder(input.sort);
    const offset = (input.page - 1) * input.pageSize;

    const [records, totals] = await this.prisma.$transaction([
      this.prisma.$queryRaw<PublicSearchRecord[]>(Prisma.sql`
        SELECT
          l.id,
          l.slug,
          l.title_km AS "titleKm",
          l.title_en AS "titleEn",
          upper(l.property_type::text) AS "propertyType",
          l.monthly_price::double precision AS "monthlyPrice",
          l.currency,
          l.available_units AS "availableUnits",
          l.available_from::text AS "availableFrom",
          l.availability_confirmed_at AS "availabilityConfirmedAt",
          l.published_at AS "publishedAt",
          p.commune,
          p.district,
          p.city,
          p.latitude::double precision AS latitude,
          p.longitude::double precision AS longitude,
          ST_Distance(p.location, i.location)::double precision AS "distanceMeters",
          amenities.items AS amenities,
          photo.id AS "primaryImageId",
          photo.public_url AS "primaryImageUrl",
          photo.alt_text_km AS "primaryImageAltKm",
          photo.alt_text_en AS "primaryImageAltEn",
          photo.width AS "primaryImageWidth",
          photo.height AS "primaryImageHeight",
          photo.sort_order AS "primaryImageSortOrder"
        FROM listings l
        INNER JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
        INNER JOIN institutions i ON i.id = ${input.institutionId}::uuid AND i.is_active = true
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', a.id,
              'key', a.key,
              'nameKm', a.name_km,
              'nameEn', a.name_en,
              'category', a.category
            ) ORDER BY a.sort_order, a.id
          ) AS items
          FROM listing_amenities la
          INNER JOIN amenities a ON a.id = la.amenity_id AND a.is_active = true
          WHERE la.listing_id = l.id
        ) amenities ON true
        LEFT JOIN LATERAL (
          SELECT li.id, li.public_url, li.alt_text_km, li.alt_text_en,
                 li.width, li.height, li.sort_order
          FROM listing_images li
          WHERE li.listing_id = l.id AND li.status = 'ready'
          ORDER BY li.sort_order, li.id
          LIMIT 1
        ) photo ON true
        WHERE ${filters}
        ORDER BY ${orderBy}
        LIMIT ${input.pageSize}
        OFFSET ${offset}
      `),
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM listings l
        INNER JOIN properties p ON p.id = l.property_id AND p.deleted_at IS NULL
        INNER JOIN institutions i ON i.id = ${input.institutionId}::uuid AND i.is_active = true
        WHERE ${filters}
      `),
    ]);

    return { records, total: Number(totals[0]?.total ?? 0) };
  }
}

function searchFilters(input: NormalizedPublicSearchInput): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`l.status = 'published'`,
    Prisma.sql`l.deleted_at IS NULL`,
    Prisma.sql`l.available_units > 0`,
    Prisma.sql`l.published_at IS NOT NULL`,
    Prisma.sql`l.availability_confirmed_at IS NOT NULL`,
    Prisma.sql`(l.available_from IS NULL OR l.available_from <= ${input.availableBy}::date)`,
    Prisma.sql`ST_DWithin(p.location, i.location, ${input.radiusMeters})`,
  ];
  if (input.viewport) {
    conditions.push(Prisma.sql`
      ST_Intersects(
        p.location,
        ST_MakeEnvelope(
          ${input.viewport.west},
          ${input.viewport.south},
          ${input.viewport.east},
          ${input.viewport.north},
          4326
        )::geography
      )
    `);
  }
  if (input.currency) {
    conditions.push(Prisma.sql`l.currency = ${input.currency}::currency`);
  }
  if (input.minPrice !== undefined) {
    conditions.push(Prisma.sql`l.monthly_price >= ${input.minPrice}`);
  }
  if (input.maxPrice !== undefined) {
    conditions.push(Prisma.sql`l.monthly_price <= ${input.maxPrice}`);
  }
  if (input.propertyTypes.length > 0) {
    const propertyTypes = input.propertyTypes.map(
      (propertyType) =>
        Prisma.sql`${propertyType.toLowerCase()}::property_type`,
    );
    conditions.push(Prisma.sql`
      l.property_type IN (${Prisma.join(propertyTypes)})
    `);
  }
  if (input.amenities.length > 0) {
    conditions.push(Prisma.sql`
      l.id IN (
        SELECT la.listing_id
        FROM listing_amenities la
        INNER JOIN amenities a ON a.id = la.amenity_id AND a.is_active = true
        WHERE a.key IN (${Prisma.join(input.amenities)})
        GROUP BY la.listing_id
        HAVING COUNT(DISTINCT a.key) = ${input.amenities.length}
      )
    `);
  }
  return Prisma.join(conditions, " AND ");
}

function searchOrder(sort: PublicListingSort): Prisma.Sql {
  switch (sort) {
    case PublicListingSort.PRICE_ASC:
      return Prisma.sql`l.monthly_price ASC, "distanceMeters" ASC, l.id ASC`;
    case PublicListingSort.PRICE_DESC:
      return Prisma.sql`l.monthly_price DESC, "distanceMeters" ASC, l.id ASC`;
    case PublicListingSort.NEWEST:
      return Prisma.sql`l.published_at DESC, "distanceMeters" ASC, l.id ASC`;
    case PublicListingSort.DISTANCE:
      return Prisma.sql`"distanceMeters" ASC, l.id ASC`;
  }
}
