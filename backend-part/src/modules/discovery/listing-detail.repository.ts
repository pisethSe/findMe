import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";

const publicDetailSelect = {
  id: true,
  slug: true,
  titleKm: true,
  titleEn: true,
  descriptionKm: true,
  descriptionEn: true,
  propertyType: true,
  monthlyPrice: true,
  currency: true,
  depositAmount: true,
  utilityNotesKm: true,
  utilityNotesEn: true,
  houseRulesKm: true,
  houseRulesEn: true,
  bedrooms: true,
  bathrooms: true,
  furnished: true,
  availableFrom: true,
  availableUnits: true,
  availabilityConfirmedAt: true,
  publishedAt: true,
  updatedAt: true,
  contactPreference: true,
  property: {
    select: {
      addressLine: true,
      commune: true,
      district: true,
      city: true,
      latitude: true,
      longitude: true,
    },
  },
  landlord: {
    select: {
      landlordProfile: {
        select: {
          displayName: true,
          contactPhone: true,
          contactTelegram: true,
        },
      },
    },
  },
  amenities: {
    where: { amenity: { isActive: true } },
    orderBy: [{ amenity: { sortOrder: "asc" } }, { amenityId: "asc" }],
    select: {
      amenity: {
        select: {
          id: true,
          key: true,
          nameKm: true,
          nameEn: true,
          category: true,
        },
      },
    },
  },
  images: {
    where: { status: "READY" },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      publicUrl: true,
      altTextKm: true,
      altTextEn: true,
      width: true,
      height: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.ListingSelect;

@Injectable()
export class ListingDetailRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPublic(slug: string, institutionId?: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        const listing = await transaction.listing.findFirst({
          where: {
            slug,
            status: "PUBLISHED",
            deletedAt: null,
            availableUnits: { gt: 0 },
            publishedAt: { not: null },
            availabilityConfirmedAt: { not: null },
            property: { deletedAt: null },
            landlord: { deletedAt: null, accountStatus: "ACTIVE" },
          },
          select: publicDetailSelect,
        });
        if (!listing) return null;
        const distances = institutionId
          ? await transaction.$queryRaw<Array<{ distance: number }>>(Prisma.sql`
            SELECT ST_Distance(p.location, i.location)::double precision AS distance
            FROM listings l INNER JOIN properties p ON p.id = l.property_id
            INNER JOIN institutions i ON i.id = ${institutionId}::uuid AND i.is_active
            WHERE l.id = ${listing.id}::uuid
          `)
          : [];
        return {
          listing,
          distanceMeters: distances[0]
            ? Math.round(distances[0].distance)
            : null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}

export type PublicDetailRecord = NonNullable<
  Awaited<ReturnType<ListingDetailRepository["findPublic"]>>
>;
