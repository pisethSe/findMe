import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

import {
  evaluateEntitlement,
  type EntitlementAccess,
} from "./entitlement-policy.js";
import { EntitlementsRepository } from "./entitlements.repository.js";
import { PublicCacheService } from "../public-cache/public-cache.service.js";

export type RestrictedSupplyAction =
  | "CREATE_LISTING"
  | "SUBMIT_LISTING"
  | "PUBLISH_LISTING"
  | "INCREASE_AVAILABILITY"
  | "MANAGE_LISTING_MEDIA";

export interface EntitlementExpirySweepResult {
  expiredLandlords: number;
  pausedListings: number;
}

const EXPIRY_SWEEP_BATCH_SIZE = 100;

@Injectable()
export class EntitlementsService {
  constructor(
    private readonly repository: EntitlementsRepository,
    private readonly publicCache: PublicCacheService,
  ) {}

  async getCurrent(landlordId: string): Promise<EntitlementAccess> {
    const now = new Date();
    const { entitlement, pausedListings } = await this.repository.expireIfDue(
      landlordId,
      now,
    );
    await this.publicCache.invalidatePublishedListings(pausedListings);
    if (!entitlement) {
      throw new ConflictException({
        code: "LANDLORD_ONBOARDING_REQUIRED",
        message:
          "Complete the landlord profile before using landlord supply tools.",
      });
    }
    return evaluateEntitlement(entitlement, now);
  }

  async sweepExpiredEntitlements(
    now = new Date(),
  ): Promise<EntitlementExpirySweepResult> {
    let expiredLandlords = 0;
    let pausedListings = 0;

    while (true) {
      const landlordIds = await this.repository.listDueLandlordIds(
        now,
        EXPIRY_SWEEP_BATCH_SIZE,
      );
      if (landlordIds.length === 0) break;

      for (const landlordId of landlordIds) {
        const result = await this.repository.expireIfDue(landlordId, now);
        if (!result.expired) continue;
        expiredLandlords += 1;
        pausedListings += result.pausedListings.length;
        await this.publicCache.invalidatePublishedListings(
          result.pausedListings,
        );
      }

      if (landlordIds.length < EXPIRY_SWEEP_BATCH_SIZE) break;
    }

    return { expiredLandlords, pausedListings };
  }

  async assertRestrictedSupplyActionAllowed(
    landlordId: string,
    action: RestrictedSupplyAction,
  ): Promise<EntitlementAccess> {
    const entitlement = await this.getCurrent(landlordId);
    if (!capabilityFor(entitlement, action)) {
      throw new ForbiddenException({
        code: "LANDLORD_ENTITLEMENT_REQUIRED",
        message:
          "An active landlord trial or access grant is required for this action.",
      });
    }
    return entitlement;
  }
}

function capabilityFor(
  entitlement: EntitlementAccess,
  action: RestrictedSupplyAction,
): boolean {
  switch (action) {
    case "CREATE_LISTING":
    case "MANAGE_LISTING_MEDIA":
      return entitlement.capabilities.canCreateListings;
    case "SUBMIT_LISTING":
      return entitlement.capabilities.canSubmitListings;
    case "PUBLISH_LISTING":
      return entitlement.capabilities.canPublishListings;
    case "INCREASE_AVAILABILITY":
      return entitlement.capabilities.canIncreaseAvailability;
  }
}
