import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @MinLength(32, { message: "Reset token is invalid." })
  @MaxLength(256, { message: "Reset token is invalid." })
  token!: string;

  @IsString()
  @MinLength(12, { message: "Password must contain at least 12 characters." })
  @MaxLength(128, { message: "Password must contain at most 128 characters." })
  @Matches(/[A-Za-z]/, { message: "Password must contain a letter." })
  @Matches(/[0-9]/, { message: "Password must contain a number." })
  password!: string;
}
