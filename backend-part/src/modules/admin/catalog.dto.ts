import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsNumber,
  IsLongitude,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import { InstitutionType } from "../../generated/prisma/client.js";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
class CatalogNamesDto {
  @Transform(trim) @IsString() @Length(1, 120) nameKm!: string;
  @Transform(trim) @IsString() @Length(1, 120) nameEn!: string;
  @IsBoolean() isActive!: boolean;
}
export class SaveAmenityDto extends CatalogNamesDto {
  @IsString()
  @Length(1, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  key!: string;
  @Transform(trim) @IsString() @Length(0, 80) category!: string;
  @IsInt() @Min(0) @Max(10000) sortOrder!: number;
}
export class SaveInstitutionDto extends CatalogNamesDto {
  @IsString()
  @Length(1, 160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
  @IsEnum(InstitutionType) type!: InstitutionType;
  @Transform(trim) @IsString() @Length(1, 500) addressEn!: string;
  @Transform(trim) @IsString() @Length(1, 120) city!: string;
  @IsNumber()
  @IsLatitude()
  latitude!: number;
  @IsNumber()
  @IsLongitude()
  longitude!: number;
}
