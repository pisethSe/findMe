import type { VerificationStatus } from "../../generated/prisma/client.js";
import type { LandlordListingRecord } from "../listings/listings.types.js";

export interface AdminPendingListingRecord extends LandlordListingRecord {
  landlordId: string;
  moderationNote: string | null;
  landlord: {
    landlordProfile: {
      displayName: string;
      businessName: string | null;
      verificationStatus: VerificationStatus;
    } | null;
  };
}
