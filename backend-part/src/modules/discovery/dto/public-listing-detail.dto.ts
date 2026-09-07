import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

export class PublicListingSlugDto {
  @IsString()
  @MaxLength(180)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}

export class PublicListingDetailQueryDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;
}
