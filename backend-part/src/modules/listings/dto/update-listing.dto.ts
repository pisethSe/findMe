import { Type, Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import {
  ContactPreference,
  Currency,
  PropertyType,
} from "../../../generated/prisma/client.js";
import { trimOptional, trimRequired } from "./listing-dto.helpers.js";

export class UpdatePropertyDto {
  @Transform(trimRequired)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name?: string;

  @Transform(trimRequired)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  addressLine?: string;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  commune?: string | null;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string | null;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @Transform(trimOptional)
  @IsOptional()
  @IsIn(["KH"])
  countryCode?: "KH";

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  googlePlaceId?: string | null;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  totalUnits?: number;
}

export class UpdateListingDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePropertyDto)
  property?: UpdatePropertyDto;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleKm?: string | null;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleEn?: string | null;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  descriptionKm?: string | null;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  descriptionEn?: string | null;

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999_999.99)
  monthlyPrice?: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  depositAmount?: number | null;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  utilityNotesKm?: string | null;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  utilityNotesEn?: string | null;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  houseRulesKm?: string | null;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  houseRulesEn?: string | null;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bedrooms?: number | null;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bathrooms?: number | null;

  @IsOptional()
  @IsBoolean()
  furnished?: boolean;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Available-from date must use YYYY-MM-DD.",
  })
  availableFrom?: string | null;

  @IsOptional()
  @IsEnum(ContactPreference)
  contactPreference?: ContactPreference;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  amenityIds?: string[];
}
