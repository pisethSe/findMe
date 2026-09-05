import { Transform, Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

function trimmedOptionalString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class SearchInstitutionsDto {
  @Transform(({ value }: { value: unknown }) => trimmedOptionalString(value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  query?: string;

  @Transform(({ value }: { value: unknown }) => trimmedOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
