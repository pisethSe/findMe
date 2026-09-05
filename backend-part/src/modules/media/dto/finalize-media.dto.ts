import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

import { trimOptional } from "../../listings/dto/listing-dto.helpers.js";

export class FinalizeMediaDto {
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altTextKm?: string;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altTextEn?: string;
}
