import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

import { ListingStatus } from "../../../generated/prisma/client.js";

export class ListLandlordListingsDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
