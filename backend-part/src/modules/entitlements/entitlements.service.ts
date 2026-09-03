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

export type RestrictedSupplyAction =
  | "CREATE_LISTING"
  | "SUBMIT_LISTING"
  | "PUBLISH_LISTING"
  | "INCREASE_AVAILABILITY";

@Injectable()
export class EntitlementsService {
  constructor(private readonly repository: EntitlementsRepository) {}

  async getCurrent(landlordId: string): Promise<EntitlementAccess> {
    const now = new Date();
    const entitlement = await this.repository.findCurrent(landlordId, now);
    if (!entitlement) {
      throw new ConflictException({
        code: "LANDLORD_ONBOARDING_REQUIRED",
        message:
          "Complete the landlord profile before using landlord supply tools.",
      });
    }
    return evaluateEntitlement(entitlement, now);
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
      return entitlement.capabilities.canCreateListings;
    case "SUBMIT_LISTING":
      return entitlement.capabilities.canSubmitListings;
    case "PUBLISH_LISTING":
      return entitlement.capabilities.canPublishListings;
    case "INCREASE_AVAILABILITY":
      return entitlement.capabilities.canIncreaseAvailability;
  }
}
