import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

import { trimRequired } from "../../listings/dto/listing-dto.helpers.js";

export class RejectListingDto {
  @Transform(trimRequired)
  @IsString()
  @MinLength(3)
  @MaxLength(2_000)
  moderationNote!: string;
}
