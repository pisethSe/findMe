import assert from "node:assert/strict";
import test from "node:test";

import { ModerationService } from "../dist/modules/moderation/moderation.service.js";

test("publication invalidates public caches only after moderation commits", async () => {
  const events = [];
  const pending = pendingListing();
  const repository = {
    findPending: async () => pending,
    approve: async (_listingId, _adminId, now) => {
      events.push("commit");
      return { ...pending, status: "PUBLISHED", publishedAt: now };
    },
  };
  const entitlements = {
    assertRestrictedSupplyActionAllowed: async () => {
      events.push("entitlement");
    },
  };
  const cache = {
    invalidatePublishedListing: async () => {
      events.push("invalidate");
    },
  };
  const service = new ModerationService(repository, entitlements, cache);

  const result = await service.approve("admin-id", pending.id);

  assert.equal(result.status, "PUBLISHED");
  assert.deepEqual(events, ["entitlement", "commit", "invalidate"]);
});

test("failed moderation never invalidates public caches", async () => {
  const events = [];
  const pending = pendingListing();
  const service = new ModerationService(
    {
      findPending: async () => pending,
      approve: async () => {
        events.push("transaction-failed");
        throw new Error("database unavailable");
      },
    },
    { assertRestrictedSupplyActionAllowed: async () => undefined },
    {
      invalidatePublishedListing: async () => {
        events.push("invalidate");
      },
    },
  );

  await assert.rejects(
    () => service.approve("admin-id", pending.id),
    /database unavailable/,
  );
  assert.deepEqual(events, ["transaction-failed"]);
});

function pendingListing() {
  const now = new Date("2026-09-04T00:00:00.000Z");
  return {
    id: "listing-id",
    landlordId: "landlord-id",
    slug: "ready-room",
    titleKm: null,
    titleEn: "Ready room",
    descriptionKm: null,
    descriptionEn: "A complete rental description.",
    propertyType: "ROOM",
    monthlyPrice: { toString: () => "95" },
    currency: "USD",
    depositAmount: null,
    utilityNotesKm: null,
    utilityNotesEn: null,
    houseRulesKm: null,
    houseRulesEn: null,
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    availableFrom: null,
    availableUnits: 1,
    availabilityConfirmedAt: now,
    contactPreference: "IN_APP_ONLY",
    status: "PENDING_REVIEW",
    moderationNote: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    landlord: {
      landlordProfile: {
        displayName: "Owner",
        businessName: null,
        verificationStatus: "UNVERIFIED",
      },
    },
    property: {
      id: "property-id",
      name: "Ready room property",
      addressLine: "Phnom Penh",
      commune: null,
      district: "Toul Kork",
      city: "Phnom Penh",
      countryCode: "KH",
      latitude: { toString: () => "11.569" },
      longitude: { toString: () => "104.891" },
      googlePlaceId: null,
      totalUnits: 1,
    },
    amenities: [],
    images: [
      {
        id: "image-id",
        publicUrl: "https://cdn.example.test/room.jpg",
        altTextKm: null,
        altTextEn: "Room",
        width: 1200,
        height: 800,
        sortOrder: 0,
        status: "READY",
      },
    ],
  };
}
