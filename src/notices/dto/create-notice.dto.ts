import { IsString, MinLength } from "class-validator";

export class CreateNoticeDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(3)
  body!: string;
}
