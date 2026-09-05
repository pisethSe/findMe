import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from "class-validator";

import { Currency, PropertyType } from "../../../generated/prisma/client.js";

export enum PublicListingSort {
  DISTANCE = "distance",
  PRICE_ASC = "price_asc",
  PRICE_DESC = "price_desc",
  NEWEST = "newest",
}

function commaSeparated(value: unknown): unknown {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) =>
    typeof item === "string"
      ? item
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : [item],
  );
}

export class SearchPublicListingsDto {
  @IsUUID("4")
  institutionId!: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(20_000)
  radiusMeters = 5_000;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  minPrice?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999_999.99)
  maxPrice?: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @Transform(({ value }: { value: unknown }) => commaSeparated(value))
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(6)
  @IsEnum(PropertyType, { each: true })
  propertyTypes?: PropertyType[];

  @Transform(({ value }: { value: unknown }) => commaSeparated(value))
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[a-z0-9][a-z0-9_-]{0,79}$/, { each: true })
  amenities?: string[];

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Available-by date must use YYYY-MM-DD.",
  })
  availableBy?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-90)
  @Max(90)
  north?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-90)
  @Max(90)
  south?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-180)
  @Max(180)
  east?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-180)
  @Max(180)
  west?: number;

  @IsOptional()
  @IsEnum(PublicListingSort)
  sort = PublicListingSort.DISTANCE;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}
