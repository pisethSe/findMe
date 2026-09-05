import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreateListingInput,
  buildUpdateListingInput,
  createInitialRentalFormValues,
  createRentalFormValuesFromListing,
  firstStepWithErrors,
  validatePhotoMetadata,
  validateRentalForSave,
  validateRentalStep,
} from "../src/features/landlord-listings/listing-form-model.ts";

import type { LandlordListingDto } from "@findme/contracts";

function validValues() {
  return {
    ...createInitialRentalFormValues(),
    propertyName: "  RUPP Student Rooms  ",
    titleKm: "បន្ទប់ជួលជិតសាកលវិទ្យាល័យ",
    totalUnits: "3",
    availableUnits: "2",
    monthlyPrice: "95",
    addressLine: "Russian Federation Boulevard, Phnom Penh",
    district: "  Tuol Kork  ",
    latitude: "11.569000",
    longitude: "104.891400",
  };
}

test("validates capacity and identifies the step containing the error", () => {
  const values = { ...validValues(), totalUnits: "1", availableUnits: "2" };
  const errors = validateRentalStep(values, 1);

  assert.match(errors.availableUnits ?? "", /cannot exceed/);
  assert.equal(firstStepWithErrors(errors), 1);
});

test("allows an incomplete private draft but gates review readiness", () => {
  const values = { ...validValues(), availableUnits: "0" };

  assert.deepEqual(
    validateRentalForSave(values, {
      submitForReview: false,
      photoCount: 0,
    }),
    {},
  );
  const reviewErrors = validateRentalForSave(values, {
    submitForReview: true,
    photoCount: 0,
  });
  assert.match(reviewErrors.availableUnits ?? "", /At least one room/);
  assert.match(reviewErrors.descriptionKm ?? "", /description/);
  assert.match(reviewErrors.photos ?? "", /at least one clear photo/i);
  assert.equal(firstStepWithErrors(reviewErrors), 1);
});

test("builds the exact create-listing payload without blank optional fields", () => {
  const payload = buildCreateListingInput({
    ...validValues(),
    amenityIds: ["00000000-0000-4000-8000-000000000501"],
    furnished: true,
  });

  assert.equal(payload.property.name, "RUPP Student Rooms");
  assert.equal(payload.property.district, "Tuol Kork");
  assert.equal(payload.property.commune, undefined);
  assert.equal(payload.monthlyPrice, 95);
  assert.equal(payload.availableUnits, 2);
  assert.equal(payload.furnished, true);
  assert.equal("descriptionEn" in payload, false);
});

test("accepts only bounded JPEG, PNG, and WebP photo metadata", () => {
  assert.equal(
    validatePhotoMetadata({ type: "image/jpeg", size: 2_048 }),
    null,
  );
  assert.match(
    validatePhotoMetadata({ type: "image/gif", size: 2_048 }) ?? "",
    /JPEG, PNG, or WebP/,
  );
  assert.match(
    validatePhotoMetadata({ type: "image/png", size: 11 * 1024 * 1024 }) ?? "",
    /10 MB/,
  );
});

test("prefills an owned rental for editing and omits dashboard-managed availability", () => {
  const current: LandlordListingDto = {
    id: "00000000-0000-4000-8000-000000000101",
    slug: "rupp-student-room",
    titleKm: "បន្ទប់ជួល",
    titleEn: null,
    descriptionKm: "បន្ទប់ស្អាត",
    descriptionEn: null,
    propertyType: "ROOM",
    monthlyPrice: 95,
    currency: "USD",
    depositAmount: 50,
    utilityNotesKm: null,
    utilityNotesEn: null,
    houseRulesKm: null,
    houseRulesEn: null,
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    availableFrom: "2026-09-10T00:00:00.000Z",
    availableUnits: 2,
    availabilityConfirmedAt: null,
    contactPreference: "IN_APP_ONLY",
    status: "DRAFT",
    publishedAt: null,
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
    property: {
      id: "00000000-0000-4000-8000-000000000102",
      name: "RUPP rooms",
      addressLine: "Russian Federation Boulevard",
      commune: null,
      district: "Tuol Kork",
      city: "Phnom Penh",
      countryCode: "KH",
      latitude: 11.569,
      longitude: 104.8914,
      googlePlaceId: null,
      totalUnits: 4,
    },
    amenities: [
      {
        id: "00000000-0000-4000-8000-000000000501",
        key: "wifi",
        nameKm: "វ៉ាយហ្វាយ",
        nameEn: "Wi-Fi",
        category: "UTILITY",
      },
    ],
    images: [],
  };
  const values = createRentalFormValuesFromListing(current);
  const update = buildUpdateListingInput({
    ...values,
    descriptionKm: "",
    depositAmount: "",
    bedrooms: "",
    availableFrom: "",
  });

  assert.equal(values.availableFrom, "2026-09-10");
  assert.equal(values.amenityIds[0], current.amenities[0]?.id);
  assert.equal(update.property.name, "RUPP rooms");
  assert.equal(update.descriptionKm, null);
  assert.equal(update.depositAmount, null);
  assert.equal(update.bedrooms, null);
  assert.equal(update.availableFrom, null);
  assert.equal("availableUnits" in update, false);
});
