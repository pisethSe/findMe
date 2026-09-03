import assert from "node:assert/strict";
import test from "node:test";

import {
  getListingFreshness,
  getPublishBlockingReasons,
  isListingDiscoverable,
  transitionListing,
} from "../src/domain/listing.ts";

const NOW = new Date("2026-09-01T00:00:00.000Z");

test("requires trust and comparison fields before review", () => {
  const reasons = getPublishBlockingReasons({
    ownerPhoneVerified: false,
    hasExactLocation: true,
    imageCount: 2,
    hasRent: true,
    hasUtilityDisclosure: false,
    hasAvailability: true,
  });

  assert.deepEqual(reasons, [
    "Verify the owner's phone number.",
    "Upload at least three property photos.",
    "Disclose utility pricing.",
  ]);
});

test("enforces listing lifecycle transitions", () => {
  assert.equal(transitionListing("draft", "pending_review"), "pending_review");
  assert.equal(transitionListing("pending_review", "active"), "active");
  assert.throws(
    () => transitionListing("draft", "active"),
    /cannot transition/,
  );
});

test("classifies availability freshness at policy boundaries", () => {
  assert.equal(
    getListingFreshness(new Date("2026-08-18T00:00:00.000Z"), NOW),
    "recent",
  );
  assert.equal(
    getListingFreshness(new Date("2026-08-17T00:00:00.000Z"), NOW),
    "stale",
  );
  assert.equal(
    getListingFreshness(new Date("2026-08-01T00:00:00.000Z"), NOW),
    "expired",
  );
});

test("only exposes approved, active, non-expired listings", () => {
  assert.equal(
    isListingDiscoverable(
      {
        status: "active",
        moderationApproved: true,
        confirmedAt: new Date("2026-08-10T00:00:00.000Z"),
      },
      NOW,
    ),
    true,
  );
  assert.equal(
    isListingDiscoverable(
      {
        status: "active",
        moderationApproved: true,
        confirmedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      NOW,
    ),
    false,
  );
  assert.equal(
    isListingDiscoverable(
      {
        status: "pending_review",
        moderationApproved: true,
        confirmedAt: new Date("2026-08-31T00:00:00.000Z"),
      },
      NOW,
    ),
    false,
  );
});
