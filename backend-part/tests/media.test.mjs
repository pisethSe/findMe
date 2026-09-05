import assert from "node:assert/strict";
import test from "node:test";

import "reflect-metadata";

const { detectImageContentType, MediaService } =
  await import("../dist/modules/media/media.service.js");

const listingId = "00000000-0000-4000-8000-000000000401";
const landlordId = "00000000-0000-4000-8000-000000000402";
const mediaId = "00000000-0000-4000-8000-000000000403";
const allowedEntitlements = {
  assertRestrictedSupplyActionAllowed: async () => undefined,
};

test("detects supported image signatures instead of trusting upload metadata", () => {
  assert.equal(
    detectImageContentType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])),
    "image/jpeg",
  );
  assert.equal(
    detectImageContentType(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    "image/png",
  );
  assert.equal(
    detectImageContentType(
      Uint8Array.from([
        0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
      ]),
    ),
    "image/webp",
  );
  assert.equal(detectImageContentType(Uint8Array.from([1, 2, 3])), null);
});

test("creates a short-lived owned-listing upload intent", async () => {
  const created = imageRecord();
  const repository = {
    findOwnedListing: async () => ({ id: listingId, status: "DRAFT" }),
    findOwnedImageAtOrder: async () => null,
    countActiveImages: async () => 0,
    createImage: async (input) => ({ ...created, ...input }),
    markFailed: async () => ({ count: 1 }),
  };
  const storage = {
    isConfigured: () => true,
    publicUrl: (key) => `https://cdn.example.test/${key}`,
    createUploadUrl: async () => ({
      uploadUrl: "https://storage.example.test/signed",
      expiresAt: new Date("2026-09-04T01:05:00.000Z"),
    }),
  };
  const service = new MediaService(repository, storage, allowedEntitlements);
  const result = await service.createUploadIntent(landlordId, {
    listingId,
    contentType: "image/jpeg",
    sizeBytes: 1024,
    sortOrder: 0,
  });

  assert.equal(result.media.listingId, listingId);
  assert.equal(result.media.sortOrder, 0);
  assert.equal(result.upload.method, "PUT");
  assert.equal(result.upload.headers["content-type"], "image/jpeg");
  assert.match(
    result.media.publicUrl,
    /^https:\/\/cdn\.example\.test\/listings\//,
  );
});

test("rejects media access when the owned listing lookup is hidden", async () => {
  const service = new MediaService(
    { findOwnedListing: async () => null },
    { isConfigured: () => true },
    allowedEntitlements,
  );

  await assert.rejects(
    service.createUploadIntent(landlordId, {
      listingId,
      contentType: "image/png",
      sizeBytes: 100,
      sortOrder: 0,
    }),
    (error) => error.getResponse().code === "LISTING_NOT_FOUND",
  );
});

test("finalize rejects a payload whose bytes do not match its signed image type", async () => {
  let failed = false;
  const repository = {
    findOwnedImage: async () => imageRecord(),
    markFailed: async () => {
      failed = true;
      return { count: 1 };
    },
  };
  const storage = {
    inspectObject: async () => ({
      contentLength: 1024,
      contentType: "image/jpeg",
      signature: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
    }),
  };
  const service = new MediaService(repository, storage, allowedEntitlements);

  await assert.rejects(
    service.finalize(landlordId, mediaId, {}),
    (error) => error.getResponse().code === "MEDIA_UPLOAD_INVALID",
  );
  assert.equal(failed, true);
});

test("rechecks server-time entitlement before issuing an upload intent", async () => {
  let created = false;
  const repository = {
    findOwnedListing: async () => ({ id: listingId, status: "DRAFT" }),
    createImage: async () => {
      created = true;
      return imageRecord();
    },
  };
  const entitlements = {
    assertRestrictedSupplyActionAllowed: async () => {
      const error = new Error("expired");
      error.code = "LANDLORD_ENTITLEMENT_REQUIRED";
      throw error;
    },
  };
  const service = new MediaService(
    repository,
    { isConfigured: () => true },
    entitlements,
  );

  await assert.rejects(
    service.createUploadIntent(landlordId, {
      listingId,
      contentType: "image/webp",
      sizeBytes: 100,
      sortOrder: 0,
    }),
    (error) => error.code === "LANDLORD_ENTITLEMENT_REQUIRED",
  );
  assert.equal(created, false);
});

function imageRecord() {
  return {
    id: mediaId,
    listingId,
    storageKey: `listings/${listingId}/photo.jpg`,
    publicUrl: "https://cdn.example.test/photo.jpg",
    altTextKm: null,
    altTextEn: null,
    width: null,
    height: null,
    sortOrder: 0,
    status: "UPLOADING",
    listing: { status: "DRAFT" },
  };
}
