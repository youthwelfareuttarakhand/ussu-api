import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../auth/strategies/jwt.strategy";
import { FeesService } from "./fees.service";
import { VerifyFeePaymentDto } from "./dto/verify-fee-payment.dto";

@Controller("fees")
@UseGuards(RolesGuard)
export class FeesController {
  constructor(private fees: FeesService) {}

  @Get("me")
  @Roles(Role.STUDENT)
  findMine(@CurrentUser() user: AuthUser) {
    return this.fees.getMine(user.sub);
  }

  // Staff student-detail view — same breakdown, keyed by studentId.
  @Get("student/:studentId")
  @Roles(Role.STAFF, Role.ADMIN)
  findForStudent(@Param("studentId") studentId: string) {
    return this.fees.getForStudent(studentId);
  }

  @Post("pay")
  @Roles(Role.STUDENT)
  pay(@CurrentUser() user: AuthUser) {
    return this.fees.payAll(user.sub);
  }

  @Post("verify-payment")
  @Roles(Role.STUDENT)
  verifyPayment(@CurrentUser() user: AuthUser, @Body() dto: VerifyFeePaymentDto) {
    return this.fees.verifyPayment(user.sub, dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature);
  }
}
