import { IsDateString, IsString, MinLength } from "class-validator";

export class ForgotPasswordDto {
  // Email or 10-digit phone number — same lookup as LoginDto.identifier.
  @IsString()
  @MinLength(3)
  identifier!: string;

  // Verification fields — must match the account on file (see AuthService.resetPassword).
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsDateString()
  dob!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;

  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}
