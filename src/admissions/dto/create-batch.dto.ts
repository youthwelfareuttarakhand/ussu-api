import { IsNotEmpty, IsString } from "class-validator";

export class CreateBatchDto {
  @IsString()
  @IsNotEmpty()
  label!: string;
}
