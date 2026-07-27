import { IsString, IsNotEmpty } from "class-validator";

export class RecordVisitDto {
  @IsString()
  @IsNotEmpty()
  path!: string;
}
