import {
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @IsEmail({}, { message: "Enter a valid email address." })
  @MaxLength(320, { message: "Email must contain at most 320 characters." })
  email!: string;

  @IsString()
  @MinLength(12, { message: "Password must contain at least 12 characters." })
  @MaxLength(128, { message: "Password must contain at most 128 characters." })
  @Matches(/[A-Za-z]/, { message: "Password must contain a letter." })
  @Matches(/[0-9]/, { message: "Password must contain a number." })
  password!: string;

  @IsIn(["KM", "EN"], {
    message: "Preferred locale must be KM or EN.",
  })
  preferredLocale!: "KM" | "EN";
}
