import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class UpdateAvailabilityDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  availableUnits!: number;
}
