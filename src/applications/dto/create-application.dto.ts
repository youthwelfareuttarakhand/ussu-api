import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsString, Matches, MinLength } from "class-validator";
import { District, ProgrammeLevel } from "@prisma/client";

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

  @IsEnum(District)
  district!: District;

  @IsEnum(ProgrammeLevel)
  programme!: ProgrammeLevel;

  @IsString()
  @IsNotEmpty()
  courseId!: string;

  @Matches(PASSWORD_RULE, {
    message: "password must be at least 8 characters and include an uppercase letter, a lowercase letter, a digit, and a special character",
  })
  password!: string;
}
