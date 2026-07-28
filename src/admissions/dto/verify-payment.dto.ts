import { IsNotEmpty, IsString } from "class-validator";

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  razorpayPaymentId!: string;

  @IsString()
  @IsNotEmpty()
  razorpaySignature!: string;
}
