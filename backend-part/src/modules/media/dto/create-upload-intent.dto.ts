import { Type } from "class-transformer";
import { IsIn, IsInt, IsUUID, Max, Min } from "class-validator";

export const LISTING_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const MAX_LISTING_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_LISTING_IMAGES = 12;

export class CreateUploadIntentDto {
  @IsUUID("4")
  listingId!: string;

  @IsIn(LISTING_IMAGE_MIME_TYPES)
  contentType!: (typeof LISTING_IMAGE_MIME_TYPES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LISTING_IMAGE_BYTES)
  sizeBytes!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_LISTING_IMAGES - 1)
  sortOrder!: number;
}
