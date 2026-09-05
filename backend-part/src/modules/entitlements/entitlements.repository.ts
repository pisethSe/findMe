import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";
import {
  EntitlementStatus,
  ListingStatus,
} from "../../generated/prisma/client.js";
import type { LandlordEntitlementRecord } from "../onboarding/onboarding.types.js";

const entitlementSelect = {
  landlordId: true,
  status: true,
  source: true,
  trialStartedAt: true,
  trialEndsAt: true,
  accessEndsAt: true,
} as const;

export interface ExpiredListingIdentity {
  id: string;
  slug: string;
}

export interface EntitlementExpiryResult {
  entitlement: LandlordEntitlementRecord | null;
  expired: boolean;
  pausedListings: ExpiredListingIdentity[];
}

@Injectable()
export class EntitlementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listDueLandlordIds(now: Date, take: number): Promise<string[]> {
    const due = await this.prisma.landlordEntitlement.findMany({
      where: {
        status: { in: [EntitlementStatus.TRIALING, EntitlementStatus.ACTIVE] },
        accessEndsAt: { lte: now },
      },
      orderBy: [{ accessEndsAt: "asc" }, { landlordId: "asc" }],
      take,
      select: { landlordId: true },
    });
    return due.map(({ landlordId }) => landlordId);
  }

  expireIfDue(landlordId: string, now: Date): Promise<EntitlementExpiryResult> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.landlordEntitlement.findUnique({
        where: { landlordId },
        select: entitlementSelect,
      });
      if (
        !current ||
        (current.status !== EntitlementStatus.TRIALING &&
          current.status !== EntitlementStatus.ACTIVE) ||
        !current.accessEndsAt ||
        current.accessEndsAt > now
      ) {
        return {
          entitlement: current,
          expired: false,
          pausedListings: [],
        };
      }

      const transition = await transaction.landlordEntitlement.updateMany({
        where: {
          landlordId,
          status: current.status,
          accessEndsAt: current.accessEndsAt,
        },
        data: { status: EntitlementStatus.EXPIRED, updatedAt: now },
      });
      if (transition.count === 0) {
        return {
          entitlement: await transaction.landlordEntitlement.findUnique({
            where: { landlordId },
            select: entitlementSelect,
          }),
          expired: false,
          pausedListings: [],
        };
      }

      const pausedListings = await transaction.listing.updateManyAndReturn({
        where: {
          landlordId,
          status: ListingStatus.PUBLISHED,
          deletedAt: null,
        },
        data: { status: ListingStatus.PAUSED, updatedAt: now },
        select: { id: true, slug: true },
      });

      await transaction.auditLog.create({
        data: {
          action: "LANDLORD_ENTITLEMENT_EXPIRED",
          entityType: "LandlordEntitlement",
          entityId: landlordId,
          metadata: {
            previousStatus: current.status,
            nextStatus: EntitlementStatus.EXPIRED,
            source: current.source,
            accessEndedAt: current.accessEndsAt.toISOString(),
            expiredAt: now.toISOString(),
            pausedListingCount: pausedListings.length,
            pausedListingIds: pausedListings.map(({ id }) => id),
          },
        },
      });

      return {
        entitlement: {
          ...current,
          status: EntitlementStatus.EXPIRED,
        },
        expired: true,
        pausedListings,
      };
    });
  }
}
