import { IsOptional, IsString } from "class-validator";

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  programme?: string;

  @IsOptional()
  @IsString()
  rollNumber?: string;
}
