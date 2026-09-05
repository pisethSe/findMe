import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";
import {
  EntitlementStatus,
  ImageStatus,
  ListingStatus,
} from "../../generated/prisma/client.js";
import { landlordListingSelect } from "../listings/listings.repository.js";
import type { AdminPendingListingRecord } from "./moderation.types.js";

const adminPendingListingSelect = {
  ...landlordListingSelect,
  landlordId: true,
  moderationNote: true,
  landlord: {
    select: {
      landlordProfile: {
        select: {
          displayName: true,
          businessName: true,
          verificationStatus: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class ModerationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPending(input: { page: number; pageSize: number }): Promise<{
    records: AdminPendingListingRecord[];
    total: number;
  }> {
    const where = {
      status: ListingStatus.PENDING_REVIEW,
      deletedAt: null,
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        select: adminPendingListingSelect,
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { records, total };
  }

  findPending(listingId: string): Promise<AdminPendingListingRecord | null> {
    return this.prisma.listing.findFirst({
      where: {
        id: listingId,
        status: ListingStatus.PENDING_REVIEW,
        deletedAt: null,
      },
      select: adminPendingListingSelect,
    });
  }

  approve(
    listingId: string,
    adminId: string,
    now: Date,
  ): Promise<AdminPendingListingRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.listing.updateMany({
        where: {
          id: listingId,
          status: ListingStatus.PENDING_REVIEW,
          deletedAt: null,
          availableUnits: { gt: 0 },
          images: { some: { status: ImageStatus.READY } },
          OR: [
            { descriptionKm: { not: null } },
            { descriptionEn: { not: null } },
          ],
          landlord: {
            landlordEntitlement: {
              is: {
                status: {
                  in: [EntitlementStatus.TRIALING, EntitlementStatus.ACTIVE],
                },
                OR: [{ accessEndsAt: null }, { accessEndsAt: { gt: now } }],
              },
            },
          },
        },
        data: {
          status: ListingStatus.PUBLISHED,
          moderationNote: null,
          publishedAt: now,
        },
      });
      if (updated.count !== 1) return null;

      await transaction.auditLog.create({
        data: {
          actorId: adminId,
          action: "LISTING_APPROVED",
          entityType: "Listing",
          entityId: listingId,
          metadata: {
            previousStatus: ListingStatus.PENDING_REVIEW,
            nextStatus: ListingStatus.PUBLISHED,
          },
        },
      });
      return transaction.listing.findUnique({
        where: { id: listingId },
        select: adminPendingListingSelect,
      });
    });
  }

  reject(
    listingId: string,
    adminId: string,
    moderationNote: string,
  ): Promise<AdminPendingListingRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.listing.updateMany({
        where: {
          id: listingId,
          status: ListingStatus.PENDING_REVIEW,
          deletedAt: null,
        },
        data: {
          status: ListingStatus.REJECTED,
          moderationNote,
          publishedAt: null,
        },
      });
      if (updated.count !== 1) return null;

      await transaction.auditLog.create({
        data: {
          actorId: adminId,
          action: "LISTING_REJECTED",
          entityType: "Listing",
          entityId: listingId,
          metadata: {
            previousStatus: ListingStatus.PENDING_REVIEW,
            nextStatus: ListingStatus.REJECTED,
          },
        },
      });
      return transaction.listing.findUnique({
        where: { id: listingId },
        select: adminPendingListingSelect,
      });
    });
  }
}
