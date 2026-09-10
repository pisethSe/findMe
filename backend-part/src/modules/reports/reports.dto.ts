import { Transform } from "class-transformer";
import {
  IsEnum,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { ReportReason } from "../../generated/prisma/client.js";

export class ReportListingParamsDto {
  @IsUUID("4")
  listingId!: string;
}
export class CreateReportDto {
  @IsEnum(ReportReason)
  reason!: ReportReason;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(2000)
  details?: string;
}
