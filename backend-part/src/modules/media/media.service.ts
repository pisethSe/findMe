import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { ImageStatus } from "../../generated/prisma/client.js";
import { EntitlementsService } from "../entitlements/entitlements.service.js";
import { canEditListing } from "../listings/listing-lifecycle.js";
import {
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGES,
  type CreateUploadIntentDto,
} from "./dto/create-upload-intent.dto.js";
import type { FinalizeMediaDto } from "./dto/finalize-media.dto.js";
import { MediaRepository, type OwnedImageRecord } from "./media.repository.js";
import { ObjectStorageService } from "./object-storage.service.js";

const IMAGE_EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

@Injectable()
export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: ObjectStorageService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async createUploadIntent(
    landlordId: string,
    input: CreateUploadIntentDto,
  ): Promise<{
    media: ReturnType<typeof toMediaDto>;
    upload: {
      url: string;
      method: "PUT";
      headers: { "content-type": string };
      expiresAt: string;
      maxBytes: number;
    };
  }> {
    if (!this.storage.isConfigured()) throw storageUnavailable();
    const listing = await this.repository.findOwnedListing(
      input.listingId,
      landlordId,
    );
    if (!listing) throw mediaListingNotFound();
    if (!canEditListing(listing.status)) {
      throw new ConflictException({
        code: "LISTING_MEDIA_STATE_INVALID",
        message: `Photos cannot be changed while a listing is ${listing.status}.`,
      });
    }
    await this.entitlements.assertRestrictedSupplyActionAllowed(
      landlordId,
      "MANAGE_LISTING_MEDIA",
    );

    const existing = await this.repository.findOwnedImageAtOrder(
      input.listingId,
      landlordId,
      input.sortOrder,
    );
    if (existing?.status === ImageStatus.READY) {
      throw new ConflictException({
        code: "LISTING_IMAGE_ORDER_TAKEN",
        message: "A ready photo already uses this order position.",
      });
    }
    if (existing) {
      await this.storage.deleteObject(existing.storageKey);
      await this.repository.deleteReplaceableImage(existing.id);
    }

    const imageCount = await this.repository.countActiveImages(input.listingId);
    if (imageCount >= MAX_LISTING_IMAGES) {
      throw new BadRequestException({
        code: "LISTING_IMAGE_LIMIT_REACHED",
        message: `A listing can contain up to ${MAX_LISTING_IMAGES} photos.`,
      });
    }

    const extension = IMAGE_EXTENSION_BY_MIME[input.contentType];
    const storageKey = `listings/${input.listingId}/${randomUUID()}.${extension}`;
    const image = await this.repository.createImage({
      listingId: input.listingId,
      storageKey,
      publicUrl: this.storage.publicUrl(storageKey),
      sortOrder: input.sortOrder,
    });

    try {
      const authorization = await this.storage.createUploadUrl(
        storageKey,
        input.contentType,
      );
      return {
        media: toMediaDto(image),
        upload: {
          url: authorization.uploadUrl,
          method: "PUT",
          headers: { "content-type": input.contentType },
          expiresAt: authorization.expiresAt.toISOString(),
          maxBytes: MAX_LISTING_IMAGE_BYTES,
        },
      };
    } catch (error) {
      await this.repository.markFailed(image.id);
      throw toStorageFailure(error);
    }
  }

  async finalize(
    landlordId: string,
    mediaId: string,
    input: FinalizeMediaDto,
  ): Promise<ReturnType<typeof toMediaDto>> {
    const image = await this.requireOwnedImage(mediaId, landlordId);
    if (!canEditListing(image.listing.status)) {
      throw new ConflictException({
        code: "LISTING_MEDIA_STATE_INVALID",
        message: `Photos cannot be changed while a listing is ${image.listing.status}.`,
      });
    }
    await this.entitlements.assertRestrictedSupplyActionAllowed(
      landlordId,
      "MANAGE_LISTING_MEDIA",
    );
    if (image.status === ImageStatus.READY) return toMediaDto(image);
    if (image.status !== ImageStatus.UPLOADING) {
      throw new ConflictException({
        code: "MEDIA_UPLOAD_NOT_PENDING",
        message: "This photo upload is no longer waiting to be finalized.",
      });
    }

    let object: Awaited<ReturnType<ObjectStorageService["inspectObject"]>>;
    try {
      object = await this.storage.inspectObject(image.storageKey);
    } catch (error) {
      if (isMissingObject(error)) {
        throw new ConflictException({
          code: "MEDIA_UPLOAD_INCOMPLETE",
          message: "Upload the photo before finalizing it.",
        });
      }
      throw toStorageFailure(error);
    }

    const expectedType = contentTypeForStorageKey(image.storageKey);
    const detectedType = detectImageContentType(object.signature);
    if (
      object.contentLength < 1 ||
      object.contentLength > MAX_LISTING_IMAGE_BYTES ||
      object.contentType !== expectedType ||
      detectedType !== expectedType
    ) {
      await this.repository.markFailed(mediaId);
      throw new BadRequestException({
        code: "MEDIA_UPLOAD_INVALID",
        message:
          "The uploaded object must be a valid JPEG, PNG, or WebP image no larger than 10 MB.",
      });
    }

    return toMediaDto(await this.repository.markReady(mediaId, input));
  }

  async remove(
    landlordId: string,
    mediaId: string,
  ): Promise<ReturnType<typeof toMediaDto>> {
    const image = await this.requireOwnedImage(mediaId, landlordId);
    if (image.status === ImageStatus.REMOVED) return toMediaDto(image);
    if (!canEditListing(image.listing.status)) {
      throw new ConflictException({
        code: "LISTING_MEDIA_STATE_INVALID",
        message: `Photos cannot be changed while a listing is ${image.listing.status}.`,
      });
    }
    await this.entitlements.assertRestrictedSupplyActionAllowed(
      landlordId,
      "MANAGE_LISTING_MEDIA",
    );

    try {
      await this.storage.deleteObject(image.storageKey);
    } catch (error) {
      throw toStorageFailure(error);
    }
    return toMediaDto(await this.repository.markRemoved(mediaId));
  }

  private async requireOwnedImage(
    mediaId: string,
    landlordId: string,
  ): Promise<OwnedImageRecord> {
    const image = await this.repository.findOwnedImage(mediaId, landlordId);
    if (image) return image;
    throw new NotFoundException({
      code: "MEDIA_NOT_FOUND",
      message: "The rental photo could not be found.",
    });
  }
}

export function detectImageContentType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function contentTypeForStorageKey(storageKey: string): string | null {
  if (storageKey.endsWith(".jpg")) return "image/jpeg";
  if (storageKey.endsWith(".png")) return "image/png";
  if (storageKey.endsWith(".webp")) return "image/webp";
  return null;
}

function toMediaDto(image: OwnedImageRecord) {
  return {
    id: image.id,
    listingId: image.listingId,
    publicUrl: image.publicUrl,
    altTextKm: image.altTextKm,
    altTextEn: image.altTextEn,
    width: image.width,
    height: image.height,
    sortOrder: image.sortOrder,
    status: image.status,
  };
}

function mediaListingNotFound(): NotFoundException {
  return new NotFoundException({
    code: "LISTING_NOT_FOUND",
    message: "The rental listing could not be found.",
  });
}

function storageUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: "MEDIA_STORAGE_UNAVAILABLE",
    message:
      "Rental photo storage is not configured or is temporarily unavailable.",
  });
}

function toStorageFailure(error: unknown): ServiceUnavailableException {
  if (error instanceof ServiceUnavailableException) return error;
  return storageUnavailable();
}

function isMissingObject(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}
