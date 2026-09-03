import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";
import { EntitlementStatus } from "../../generated/prisma/client.js";
import type { LandlordEntitlementRecord } from "../onboarding/onboarding.types.js";

const entitlementSelect = {
  landlordId: true,
  status: true,
  source: true,
  trialStartedAt: true,
  trialEndsAt: true,
  accessEndsAt: true,
} as const;

@Injectable()
export class EntitlementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrent(
    landlordId: string,
    now: Date,
  ): Promise<LandlordEntitlementRecord | null> {
    await this.prisma.landlordEntitlement.updateMany({
      where: {
        landlordId,
        status: { in: [EntitlementStatus.TRIALING, EntitlementStatus.ACTIVE] },
        accessEndsAt: { lte: now },
      },
      data: { status: EntitlementStatus.EXPIRED },
    });

    return this.prisma.landlordEntitlement.findUnique({
      where: { landlordId },
      select: entitlementSelect,
    });
  }
}
