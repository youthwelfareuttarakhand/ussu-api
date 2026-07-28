import { IsBoolean } from "class-validator";

export class PayDraftDto {
  @IsBoolean()
  declarationAccepted!: boolean;
}
