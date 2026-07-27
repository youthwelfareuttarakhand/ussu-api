import { IsString, MinLength } from "class-validator";

export class LoginDto {
  // Email or 10-digit phone number — AuthService looks up whichever matches.
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
