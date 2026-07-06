import { IsEnum } from "class-validator";
import { AdmissionStatus } from "@prisma/client";

export class UpdateAdmissionStatusDto {
  @IsEnum(AdmissionStatus)
  status!: AdmissionStatus;
}
