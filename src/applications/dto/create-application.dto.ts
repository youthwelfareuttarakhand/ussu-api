import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { ProgrammeLevel } from "@prisma/client";

// At least 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char.
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export class CreateApplicationDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @Matches(/^[0-9]{10}$/, { message: "phone must be a 10-digit number" })
  phone!: string;

  @IsDateString()
  dob!: string;

  @IsString()
  @IsNotEmpty()
  countryId!: string;

  // Only present/required when countryId resolves to India — enforced by the
  // frontend hiding the field for other countries, not re-validated here.
  @IsOptional()
  @IsString()
  stateId?: string;

  @IsEnum(ProgrammeLevel)
  programme!: ProgrammeLevel;

  @Matches(PASSWORD_RULE, {
    message: "password must be at least 8 characters and include an uppercase letter, a lowercase letter, a digit, and a special character",
  })
  password!: string;
}
