import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";

class PersonalDetailsDto {
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() aadharNumber?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsBoolean() uttarakhandDomicile?: boolean;
  @IsOptional() @IsString() mediumOfInstruction?: string;
  @IsOptional() @IsBoolean() hostelRequired?: boolean;
  // Only meaningful for Diploma in Sports Coaching applicants.
  @IsOptional() @IsString() coachingDiscipline?: string;
  // Not Admission columns — updates Student.programme/programmeLevel
  // instead, see AdmissionsService.patchDraft. Lets the applicant change
  // their course selection from the admission form, not just at registration.
  @IsOptional() @IsString() courseId?: string;
}

class ParentDetailsDto {
  @IsOptional() @IsString() fatherName?: string;
  @IsOptional() @IsString() motherName?: string;
  @IsOptional() @IsString() guardianName?: string;
  @IsOptional() @IsString() guardianPhone?: string;
  @IsOptional() @IsEmail() guardianEmail?: string;
  @IsOptional() @IsString() occupation?: string;
}

class AddressDetailsDto {
  @IsOptional() @IsString() line1?: string;
  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
}

class AcademicDetailsDto {
  @IsOptional() @IsString() tenthBoard?: string;
  @IsOptional() @IsString() tenthRollNo?: string;
  @IsOptional() @IsInt() tenthYear?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) tenthPercentage?: number;
  @IsOptional() @IsString() twelfthBoard?: string;
  @IsOptional() @IsString() twelfthStream?: string;
  @IsOptional() @IsInt() twelfthYear?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) twelfthPercentage?: number;
  @IsOptional() @IsBoolean() gapYear?: boolean;
  // Diploma in Sports Coaching applicants only.
  @IsOptional() @IsString() graduationDiscipline?: string;
  @IsOptional() @IsString() graduationInstitution?: string;
  @IsOptional() @IsInt() graduationYear?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) graduationPercentage?: number;
}

class SportsDetailsDto {
  @IsOptional() @IsString() primarySport?: string;
  @IsOptional() @IsString() highestLevel?: string;
  @IsOptional() @IsString() positionHeld?: string;
  @IsOptional() @IsString() certifyingAuthority?: string;
  @IsOptional() @IsInt() yearOfAchievement?: number;
  @IsOptional() @IsBoolean() eminentSportsperson?: boolean;
}

// One endpoint for all 6 steps of the dashboard admission form — the wizard
// sends only the section it just saved, all sections optional, upserted
// independently. Simpler than 6 separate PATCH routes.
export class PatchDraftAdmissionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalDetailsDto)
  personal?: PersonalDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ParentDetailsDto)
  parent?: ParentDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDetailsDto)
  address?: AddressDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AcademicDetailsDto)
  academic?: AcademicDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SportsDetailsDto)
  sports?: SportsDetailsDto;
}
