import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
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
}
