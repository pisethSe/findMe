import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

function trimOptional({ value }: { value: unknown }): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export class CompleteLandlordOnboardingDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: "Display name must contain at least 2 characters." })
  @MaxLength(120, {
    message: "Display name must contain at most 120 characters.",
  })
  displayName!: string;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(160, {
    message: "Business name must contain at most 160 characters.",
  })
  businessName?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(32, {
    message: "Contact phone must contain at most 32 characters.",
  })
  @Matches(/^\+?[0-9][0-9\s-]{6,30}$/, {
    message: "Enter a valid contact phone number.",
  })
  contactPhone!: string;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(33, {
    message: "Telegram username must contain at most 32 characters.",
  })
  @Matches(/^@?[A-Za-z0-9_]{5,32}$/, {
    message: "Enter a valid Telegram username.",
  })
  contactTelegram?: string;
}
