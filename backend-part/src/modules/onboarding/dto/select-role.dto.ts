import { Transform } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class SelectRoleDto {
  @IsIn(["STUDENT", "LANDLORD"], {
    message: "Role must be STUDENT or LANDLORD.",
  })
  role!: "STUDENT" | "LANDLORD";

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Display name must contain at least 2 characters." })
  @MaxLength(120, {
    message: "Display name must contain at most 120 characters.",
  })
  displayName?: string;
}
