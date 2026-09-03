import { IsEmail, MaxLength } from "class-validator";

export class ForgotPasswordDto {
  @IsEmail({}, { message: "Enter a valid email address." })
  @MaxLength(320, { message: "Email must contain at most 320 characters." })
  email!: string;
}
