import { Transform, Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ListingStatus, ReportStatus } from "../../generated/prisma/client.js";

export class AdminIdDto {
  @IsUUID("4") id!: string;
}
export class AdminPageDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) query?: string;
}
export class AdminReportsQueryDto extends AdminPageDto {
  @IsEnum(ReportStatus) status: ReportStatus = "OPEN";
}
export class AdminListingsQueryDto extends AdminPageDto {
  @IsOptional() @IsEnum(ListingStatus) status?: ListingStatus;
}
export class AdminNoteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @Length(3, 2000)
  note!: string;
}
export class UpdateReportDto extends AdminNoteDto {
  @IsEnum(ReportStatus) expectedStatus!: ReportStatus;
  @IsIn(["IN_REVIEW", "RESOLVED", "DISMISSED"]) status!:
    "IN_REVIEW" | "RESOLVED" | "DISMISSED";
}
export class RemoveListingDto extends AdminNoteDto {
  @IsEnum(ListingStatus) expectedStatus!: ListingStatus;
}
