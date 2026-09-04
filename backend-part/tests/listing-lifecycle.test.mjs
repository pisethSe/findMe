import assert from "node:assert/strict";
import test from "node:test";

import {
  canEditListing,
  canUpdateAvailability,
  nextListingStatus,
} from "../dist/modules/listings/listing-lifecycle.js";

test("landlord listing transitions allow only deliberate lifecycle actions", () => {
  assert.equal(nextListingStatus("DRAFT", "SUBMIT"), "PENDING_REVIEW");
  assert.equal(nextListingStatus("DRAFT", "ARCHIVE"), "ARCHIVED");
  assert.equal(nextListingStatus("PUBLISHED", "PAUSE"), "PAUSED");
  assert.equal(nextListingStatus("PUBLISHED", "MARK_RENTED"), "RENTED");
  assert.equal(nextListingStatus("PAUSED", "SUBMIT"), "PENDING_REVIEW");
  assert.equal(nextListingStatus("RENTED", "SUBMIT"), "PENDING_REVIEW");
  assert.equal(nextListingStatus("REJECTED", "SUBMIT"), "PENDING_REVIEW");

  assert.equal(nextListingStatus("DRAFT", "PAUSE"), null);
  assert.equal(nextListingStatus("PENDING_REVIEW", "PAUSE"), null);
  assert.equal(nextListingStatus("PENDING_REVIEW", "ARCHIVE"), "ARCHIVED");
  assert.equal(nextListingStatus("ARCHIVED", "SUBMIT"), null);
});

test("editing and availability policies keep reviewed and archived states safe", () => {
  for (const status of ["DRAFT", "PAUSED", "RENTED", "REJECTED"]) {
    assert.equal(canEditListing(status), true);
  }
  assert.equal(canEditListing("PENDING_REVIEW"), false);
  assert.equal(canEditListing("PUBLISHED"), false);
  assert.equal(canEditListing("ARCHIVED"), false);

  for (const status of [
    "DRAFT",
    "PENDING_REVIEW",
    "PUBLISHED",
    "PAUSED",
    "RENTED",
    "REJECTED",
  ]) {
    assert.equal(canUpdateAvailability(status), true);
  }
  assert.equal(canUpdateAvailability("ARCHIVED"), false);
});
