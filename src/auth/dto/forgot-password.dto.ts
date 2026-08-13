import { IsString, MinLength } from "class-validator";

export class ForgotPasswordDto {
  // Email or 10-digit phone number — same lookup as LoginDto.identifier.
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;

  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}
