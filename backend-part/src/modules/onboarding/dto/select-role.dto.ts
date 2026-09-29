import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/**
 * Keep these limits aligned with the public search bounds. A student campus
 * preference is only a search default, so it must never widen or narrow what
 * the student can still search manually.
 */
const MIN_PREFERRED_RADIUS_METERS = 100;
const MAX_PREFERRED_RADIUS_METERS = 20_000;

/**
 * Monthly room budget bounds in USD. They stay well above the public search
 * minimum and cap the preference at a realistic monthly rent so the saved
 * value remains a useful search default.
 */
const MIN_PREFERRED_PRICE_USD = 0.01;
const MAX_PREFERRED_PRICE_USD = 100_000;

export class SelectRoleDto {
  @IsIn(["STUDENT", "LANDLORD"], {
    message: "Role must be STUDENT or LANDLORD.",
  })
  role!: "STUDENT" | "LANDLORD";

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Display name must contain at least 2 characters." })
  @MaxLength(120, {
    message: "Display name must contain at most 120 characters.",
  })
  displayName?: string;

  @IsOptional()
  @IsUUID("4", { message: "Institution must be a valid institution id." })
  institutionId?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: "Preferred radius must be a whole number of metres." })
  @Min(MIN_PREFERRED_RADIUS_METERS, {
    message: `Preferred radius must be at least ${MIN_PREFERRED_RADIUS_METERS} metres.`,
  })
  @Max(MAX_PREFERRED_RADIUS_METERS, {
    message: `Preferred radius must be at most ${MAX_PREFERRED_RADIUS_METERS} metres.`,
  })
  preferredRadiusMeters?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        "Preferred minimum price must be a number with at most 2 decimals.",
    },
  )
  @Min(MIN_PREFERRED_PRICE_USD, {
    message: "Preferred minimum price must be at least 0.01 USD.",
  })
  @Max(MAX_PREFERRED_PRICE_USD, {
    message: "Preferred minimum price must be at most 100000 USD.",
  })
  preferredMinPrice?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        "Preferred maximum price must be a number with at most 2 decimals.",
    },
  )
  @Min(MIN_PREFERRED_PRICE_USD, {
    message: "Preferred maximum price must be at least 0.01 USD.",
  })
  @Max(MAX_PREFERRED_PRICE_USD, {
    message: "Preferred maximum price must be at most 100000 USD.",
  })
  preferredMaxPrice?: number;
}
