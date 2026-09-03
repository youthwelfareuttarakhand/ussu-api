import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateNoticeDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  body?: string;
}
