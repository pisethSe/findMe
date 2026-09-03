import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "Enter a valid email address." })
  @MaxLength(320, { message: "Email must contain at most 320 characters." })
  email!: string;

  @IsString()
  @MinLength(1, { message: "Password is required." })
  @MaxLength(128, { message: "Password must contain at most 128 characters." })
  password!: string;
}
