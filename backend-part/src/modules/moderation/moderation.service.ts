import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ImageStatus } from "../../generated/prisma/client.js";
import { EntitlementsService } from "../entitlements/entitlements.service.js";
import { toLandlordListingDto } from "../listings/listings.service.js";
import { PublicCacheService } from "../public-cache/public-cache.service.js";
import type { ListPendingListingsDto } from "./dto/list-pending-listings.dto.js";
import { ModerationRepository } from "./moderation.repository.js";
import type { AdminPendingListingRecord } from "./moderation.types.js";

@Injectable()
export class ModerationService {
  constructor(
    private readonly repository: ModerationRepository,
    private readonly entitlements: EntitlementsService,
    private readonly publicCache: PublicCacheService,
  ) {}

  async listPending(query: ListPendingListingsDto) {
    const result = await this.repository.listPending(query);
    return {
      data: result.records.map(toAdminListingDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  async approve(adminId: string, listingId: string) {
    const pending = await this.requirePending(listingId);
    assertPublicationReady(pending);
    await this.entitlements.assertRestrictedSupplyActionAllowed(
      pending.landlordId,
      "PUBLISH_LISTING",
    );

    const published = await this.repository.approve(
      listingId,
      adminId,
      new Date(),
    );
    if (!published) throw concurrentModeration();

    await this.publicCache.invalidatePublishedListing(published);
    return toAdminListingDto(published);
  }

  async reject(adminId: string, listingId: string, moderationNote: string) {
    await this.requirePending(listingId);
    const rejected = await this.repository.reject(
      listingId,
      adminId,
      moderationNote,
    );
    if (!rejected) throw concurrentModeration();
    return toAdminListingDto(rejected);
  }

  private async requirePending(
    listingId: string,
  ): Promise<AdminPendingListingRecord> {
    const listing = await this.repository.findPending(listingId);
    if (listing) return listing;
    throw new NotFoundException({
      code: "PENDING_LISTING_NOT_FOUND",
      message: "The pending rental listing could not be found.",
    });
  }
}

function assertPublicationReady(listing: AdminPendingListingRecord): void {
  const hasDescription = Boolean(
    listing.descriptionKm?.trim() || listing.descriptionEn?.trim(),
  );
  const hasReadyPhoto = listing.images.some(
    (image) => image.status === ImageStatus.READY,
  );
  if (listing.availableUnits > 0 && hasDescription && hasReadyPhoto) return;

  throw new ConflictException({
    code: "LISTING_NOT_READY_FOR_PUBLICATION",
    message:
      "A listing needs available rooms, a description, and a ready photo before publication.",
  });
}

function concurrentModeration(): ConflictException {
  return new ConflictException({
    code: "LISTING_MODERATION_CONFLICT",
    message:
      "The listing changed while it was being moderated. Review it again.",
  });
}

function toAdminListingDto(listing: AdminPendingListingRecord) {
  const profile = listing.landlord.landlordProfile;
  if (!profile) {
    throw new ConflictException({
      code: "LANDLORD_PROFILE_MISSING",
      message: "The listing owner does not have a landlord profile.",
    });
  }
  return {
    ...toLandlordListingDto(listing),
    moderationNote: listing.moderationNote,
    landlord: {
      displayName: profile.displayName,
      businessName: profile.businessName,
      verificationStatus: profile.verificationStatus,
    },
  };
}
