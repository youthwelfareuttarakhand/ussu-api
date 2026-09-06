import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

// Shared shape for the staff list endpoints (Admissions Queue, Students,
// Registrations) — all three were fetching every matching row unpaginated,
// which got slower every admission cycle. `all: true` bypasses page/limit
// entirely for the "Export to Excel" actions, which still need the complete
// filtered set, not just one page of it.
export class PaginatedListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  all?: boolean = false;

  @IsOptional()
  @IsString()
  course?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  discipline?: string;

  // Students list only — derived at query time from FeeStructure/FeePayment,
  // not a stored column. See StudentsService.findAll.
  @IsOptional()
  @IsString()
  feeStatus?: string;

  // Free-text search against applicant name/email/roll number.
  @IsOptional()
  @IsString()
  search?: string;
}

export type PaginatedResult<T> = { data: T[]; total: number };
