import { IsObject } from "class-validator";

export class CreateAdmissionDto {
  @IsObject()
  formData!: Record<string, unknown>;
}
