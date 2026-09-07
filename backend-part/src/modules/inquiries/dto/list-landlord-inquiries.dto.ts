import { Transform } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class ListStudentInquiriesDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 12;
}

export class ListLandlordInquiriesDto extends ListStudentInquiriesDto {
  override pageSize = 5;
}
