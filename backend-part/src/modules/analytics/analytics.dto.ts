import { IsDateString, Matches } from "class-validator";

export class AnalyticsSummaryQueryDto {
  @IsDateString({ strict: true })
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @IsDateString({ strict: true })
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  to!: string;
}
