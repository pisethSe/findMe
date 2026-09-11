import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { ListFavoritesDto } from "./favorites.dto.js";
import { recordAnalyticsEvent } from "../analytics/analytics.events.js";

// Match public detail eligibility. Saved rows survive a rental's withdrawal,
// but its former public content must never become a private-data back door.
const publicListingWhere = {
  status: "PUBLISHED",
  deletedAt: null,
  availableUnits: { gt: 0 },
  publishedAt: { not: null },
  availabilityConfirmedAt: { not: null },
  property: { deletedAt: null },
  landlord: { deletedAt: null, accountStatus: "ACTIVE" },
} satisfies Prisma.ListingWhereInput;

const summarySelect = {
  id: true,
  slug: true,
  titleKm: true,
  titleEn: true,
  propertyType: true,
  monthlyPrice: true,
  currency: true,
  availableUnits: true,
  availableFrom: true,
  availabilityConfirmedAt: true,
  publishedAt: true,
  property: {
    select: {
      commune: true,
      district: true,
      city: true,
      latitude: true,
      longitude: true,
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
    take: 1,
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
export class FavoritesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(studentId: string, query: ListFavoritesDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const where = {
          studentId,
          ...(query.listingIds ? { listingId: { in: query.listingIds } } : {}),
        };
        const favorites = await tx.favorite.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { listingId: "asc" }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: { listingId: true, createdAt: true },
        });
        const total = await tx.favorite.count({ where });
        const listings = await tx.listing.findMany({
          where: {
            ...publicListingWhere,
            id: { in: favorites.map((f) => f.listingId) },
          },
          select: summarySelect,
        });
        const summaries = new Map(
          listings.map((l) => [
            l.id,
            {
              id: l.id,
              slug: l.slug,
              titleKm: l.titleKm,
              titleEn: l.titleEn,
              propertyType: l.propertyType,
              monthlyPrice: Number(l.monthlyPrice),
              currency: l.currency,
              availableUnits: l.availableUnits,
              availableFrom:
                l.availableFrom?.toISOString().slice(0, 10) ?? null,
              availabilityConfirmedAt:
                l.availabilityConfirmedAt?.toISOString() ?? null,
              publishedAt: l.publishedAt?.toISOString() ?? null,
              location: {
                ...l.property,
                latitude: Number(l.property.latitude),
                longitude: Number(l.property.longitude),
              },
              amenities: l.amenities.map(({ amenity }) => amenity),
              primaryImage: l.images[0] ?? null,
            },
          ]),
        );
        return {
          data: favorites.map((f) => ({
            listingId: f.listingId,
            savedAt: f.createdAt.toISOString(),
            listing: summaries.get(f.listingId) ?? null,
          })),
          meta: {
            page: query.page,
            pageSize: query.pageSize,
            total,
            totalPages: Math.ceil(total / query.pageSize),
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async save(studentId: string, listingId: string): Promise<void> {
    // A serializable transaction validates visibility and inserts atomically.
    // Retry serialization conflicts, including simultaneous duplicate saves.
    for (let attempt = 0; ; attempt += 1) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            if (
              await tx.favorite.findUnique({
                where: { studentId_listingId: { studentId, listingId } },
              })
            )
              return;
            const listing = await tx.listing.findFirst({
              where: { ...publicListingWhere, id: listingId },
              select: { id: true },
            });
            if (!listing)
              throw new NotFoundException({
                code: "LISTING_NOT_FOUND",
                message: "This rental is unavailable or could not be found.",
              });
            const created = await tx.favorite.createMany({
              data: [{ studentId, listingId }],
              skipDuplicates: true,
            });
            if (created.count === 1)
              await recordAnalyticsEvent(tx, "FAVORITE_SAVED");
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 3
        )
          continue;
        throw error;
      }
    }
  }

  async remove(studentId: string, listingId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.favorite.deleteMany({
        where: { studentId, listingId },
      });
      if (removed.count === 1)
        await recordAnalyticsEvent(tx, "FAVORITE_REMOVED");
    });
  }
}
