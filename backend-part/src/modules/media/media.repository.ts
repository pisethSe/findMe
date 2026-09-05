import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";
import {
  ImageStatus,
  type ListingStatus,
} from "../../generated/prisma/client.js";

const imageSelect = {
  id: true,
  listingId: true,
  storageKey: true,
  publicUrl: true,
  altTextKm: true,
  altTextEn: true,
  width: true,
  height: true,
  sortOrder: true,
  status: true,
  listing: { select: { status: true } },
} as const;

export interface OwnedImageRecord {
  id: string;
  listingId: string;
  storageKey: string;
  publicUrl: string;
  altTextKm: string | null;
  altTextEn: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  status: ImageStatus;
  listing: { status: ListingStatus };
}

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOwnedListing(
    listingId: string,
    landlordId: string,
  ): Promise<{ id: string; status: ListingStatus } | null> {
    return this.prisma.listing.findFirst({
      where: { id: listingId, landlordId, deletedAt: null },
      select: { id: true, status: true },
    });
  }

  countActiveImages(listingId: string): Promise<number> {
    return this.prisma.listingImage.count({
      where: { listingId, status: { not: ImageStatus.REMOVED } },
    });
  }

  findOwnedImageAtOrder(
    listingId: string,
    landlordId: string,
    sortOrder: number,
  ): Promise<OwnedImageRecord | null> {
    return this.prisma.listingImage.findFirst({
      where: {
        listingId,
        sortOrder,
        listing: { landlordId, deletedAt: null },
      },
      select: imageSelect,
    });
  }

  createImage(input: {
    listingId: string;
    storageKey: string;
    publicUrl: string;
    sortOrder: number;
  }): Promise<OwnedImageRecord> {
    return this.prisma.listingImage.create({
      data: input,
      select: imageSelect,
    });
  }

  findOwnedImage(
    mediaId: string,
    landlordId: string,
  ): Promise<OwnedImageRecord | null> {
    return this.prisma.listingImage.findFirst({
      where: {
        id: mediaId,
        listing: { landlordId, deletedAt: null },
      },
      select: imageSelect,
    });
  }

  deleteReplaceableImage(mediaId: string): Promise<{ count: number }> {
    return this.prisma.listingImage.deleteMany({
      where: {
        id: mediaId,
        status: {
          in: [ImageStatus.UPLOADING, ImageStatus.FAILED, ImageStatus.REMOVED],
        },
      },
    });
  }

  markReady(
    mediaId: string,
    input: { altTextKm?: string; altTextEn?: string },
  ): Promise<OwnedImageRecord> {
    return this.prisma.listingImage.update({
      where: { id: mediaId },
      data: { status: ImageStatus.READY, ...input },
      select: imageSelect,
    });
  }

  markFailed(mediaId: string): Promise<{ count: number }> {
    return this.prisma.listingImage.updateMany({
      where: { id: mediaId, status: ImageStatus.UPLOADING },
      data: { status: ImageStatus.FAILED },
    });
  }

  markRemoved(mediaId: string): Promise<OwnedImageRecord> {
    return this.prisma.listingImage.update({
      where: { id: mediaId },
      data: { status: ImageStatus.REMOVED },
      select: imageSelect,
    });
  }
}
