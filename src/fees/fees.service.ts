import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { StudentsService } from "../students/students.service";
import type { FeeCadence } from "@prisma/client";

// No semester-progression tracker exists yet, so a student is only ever
// charged the first cycle of each fee line item. Revisit once real
// enrollment-year/semester tracking exists.
function firstCycleLabel(cadence: FeeCadence): string {
  return cadence === "YEAR" ? "Year 1" : "Semester 1";
}

@Injectable()
export class FeesService {
  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
    private students: StudentsService,
    private config: ConfigService,
  ) {}

  // Course fee (always applicable) + hostel fee (applicable only if the
  // student answered yes on their admission) — the two line items shown and
  // billed together on the Fee Submission page.
  private async getApplicableStructures(studentId: string, courseId: string) {
    const [structures, admission] = await Promise.all([
      this.prisma.feeStructure.findMany({
        where: { courseId },
        include: { payments: { where: { studentId } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.admission.findUnique({ where: { studentId }, select: { hostelRequired: true } }),
    ]);

    return structures.map((s) => {
      const payment = s.payments.find((p) => p.cycleLabel === firstCycleLabel(s.cadence));
      const opted = s.requiresHostelOptIn ? Boolean(admission?.hostelRequired) : true;
      return { structure: s, payment, opted };
    });
  }

  // Per-line-item breakdown, used by the Fee Receipt page.
  async getMine(userId: string) {
    const student = await this.students.findByUserId(userId);
    if (!student.courseId) return [];

    const rows = await this.getApplicableStructures(student.id, student.courseId);
    return rows.map(({ structure: s, payment, opted }) => ({
      id: s.id,
      label: s.label,
      cadence: s.cadence,
      cycleLabel: firstCycleLabel(s.cadence),
      amountPaise: opted ? s.amountPaise : 0,
      mandatory: s.requiresHostelOptIn ? opted : s.mandatory,
      status: payment?.paid ? ("PAID" as const) : ("UNPAID" as const),
      feePaymentId: payment?.id ?? null,
      razorpayPaymentId: payment?.razorpayPaymentId ?? null,
      paidAt: payment?.paidAt ?? null,
    }));
  }

  // Combined course-fee + hostel-fee (if opted) checkout: one Razorpay order
  // covering every unpaid applicable line item at once.
  async payAll(userId: string) {
    const student = await this.students.findByUserId(userId);
    if (!student.courseId) throw new NotFoundException("No fee structure is set up for your course");

    const rows = await this.getApplicableStructures(student.id, student.courseId);
    const unpaid = rows.filter((r) => r.opted && !r.payment?.paid);
    if (unpaid.length === 0) throw new ConflictException("All applicable fees are already paid");

    const totalPaise = unpaid.reduce((sum, r) => sum + r.structure.amountPaise, 0);
    const receipt = `fee_${Date.now()}`;

    let order: Awaited<ReturnType<PaymentsService["createOrder"]>>;
    try {
      order = await this.payments.createOrder(totalPaise, receipt);
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 401) throw new UnauthorizedException("Payment provider authentication failed");
      throw new InternalServerErrorException("Could not reach the payment provider. Please try again.");
    }

    await Promise.all(
      unpaid.map(({ structure: s }) => {
        const cycleLabel = firstCycleLabel(s.cadence);
        return this.prisma.feePayment.upsert({
          where: { studentId_feeStructureId_cycleLabel: { studentId: student.id, feeStructureId: s.id, cycleLabel } },
          update: { razorpayOrderId: order.id, amountPaise: s.amountPaise },
          create: {
            studentId: student.id,
            feeStructureId: s.id,
            cycleLabel,
            amountPaise: s.amountPaise,
            razorpayOrderId: order.id,
          },
        });
      }),
    );

    return {
      razorpayOrderId: order.id,
      razorpayKeyId: this.config.get<string>("razorpay.keyId"),
      amount: order.amount,
    };
  }

  async verifyPayment(userId: string, razorpayOrderId: string, paymentId: string, signature: string) {
    const student = await this.students.findByUserId(userId);
    const matching = await this.prisma.feePayment.findFirst({ where: { studentId: student.id, razorpayOrderId } });
    if (!matching) throw new BadRequestException("No payment has been initiated for this order");
    if (matching.paid) return { paid: true };

    const valid = this.payments.verifyCheckoutSignature(razorpayOrderId, paymentId, signature);
    if (!valid) throw new UnauthorizedException("Payment signature verification failed");

    await this.markPaidByOrderId(razorpayOrderId, paymentId);
    return { paid: true };
  }

  // Called from the Razorpay webhook. Silently ignores an orderId that isn't
  // a fee-payment order (e.g. an admission-fee order) — safe to call
  // unconditionally alongside AdmissionsService's equivalent handler.
  async handlePaymentCaptured(orderId: string, paymentId: string) {
    await this.markPaidByOrderId(orderId, paymentId);
  }

  // Idempotent: re-checks `paid` inside the transaction so whichever of
  // client-verify/webhook arrives first wins. Updates every FeePayment row
  // sharing this orderId — a combined checkout can cover several line items.
  private async markPaidByOrderId(orderId: string, paymentId: string) {
    await this.prisma.feePayment.updateMany({
      where: { razorpayOrderId: orderId, paid: false },
      data: { paid: true, razorpayPaymentId: paymentId, paidAt: new Date() },
    });
  }
}
