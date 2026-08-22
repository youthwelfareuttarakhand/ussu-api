import { IsISO8601, IsOptional, IsString } from "class-validator";

export class UpdateBatchExamDetailsDto {
  @IsOptional()
  @IsISO8601()
  examDate?: string;

  @IsOptional()
  @IsString()
  reportingTime?: string;

  @IsOptional()
  @IsString()
  examCentreName?: string;

  @IsOptional()
  @IsString()
  examCentreAddress?: string;
}
