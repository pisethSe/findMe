import { Transform } from "class-transformer";
import { IsIn, IsString, IsUUID, Length } from "class-validator";

export class InquiryListingParamsDto {
  @IsUUID("4")
  listingId!: string;
}

export class InquiryParamsDto {
  @IsUUID("4")
  id!: string;
}

export class CreateInquiryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @Length(1, 2000)
  message!: string;

  @IsUUID("4")
  clientRequestId!: string;
}

export class UpdateInquiryStatusDto {
  @IsIn(["READ", "RESPONDED", "CLOSED"])
  status!: "READ" | "RESPONDED" | "CLOSED";
}
