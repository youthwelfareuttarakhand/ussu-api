import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentType, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { StudentsService } from "../students/students.service";
import { UkssuService } from "../ukssu/ukssu.service";
import { StorageService } from "../storage/storage.service";
import { MailService } from "../mail/mail.service";
import type { AdmissionStatus } from "@prisma/client";
import type { CreateBatchDto } from "./dto/create-batch.dto";
import type { PatchDraftAdmissionDto } from "./dto/patch-draft-admission.dto";

const ALLOWED_DOCUMENT_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

const draftInclude = {
  batch: true,
  parentDetails: true,
  addressDetails: true,
  academicDetails: true,
  sportsDetails: true,
  // Never select `data` here — it can be several MB of raw bytes (DB-fallback
  // storage) and isn't JSON-serializable the way the frontend expects.
  // Fetched separately via the dedicated file-serving endpoint instead.
  documents: {
    select: { id: true, admissionId: true, type: true, filename: true, url: true, mimeType: true, uploadedAt: true },
  },
  // Applicant identity — needed for the staff-facing admissions list/detail
  // views to show who this admission belongs to.
  student: {
    select: {
      id: true,
      rollNumber: true,
      programme: true,
      country: { select: { id: true, name: true } },
      state: { select: { id: true, name: true } },
      programmeLevel: true,
      user: { select: { fullName: true, email: true, phone: true, dob: true, ukssuId: true, registrationNumber: true } },
    },
  },
} as const;

@Injectable()
export class AdmissionsService {
  constructor(
    private prisma: PrismaService,
    private students: StudentsService,
    private ukssu: UkssuService,
    private payments: PaymentsService,
    private config: ConfigService,
    private storage: StorageService,
    private mail: MailService,
  ) {}

  // Staff queue only shows completed, paid applications — unpaid drafts
  // (applicant started the form but never finished/paid) are noise for staff.
  findAll() {
    return this.prisma.admission.findMany({
      where: { paid: true },
      orderBy: { submittedAt: "desc" },
      include: draftInclude,
    });
  }

  // Staff-facing single-admission detail view (the full form a student
  // filled out — personal/parent/address/academic/documents).
  async findOne(id: string) {
    const admission = await this.prisma.admission.findUnique({ where: { id }, include: draftInclude });
    if (!admission) throw new NotFoundException("Admission not found");
    return admission;
  }

  async findForUser(userId: string) {
    const student = await this.students.findByUserId(userId);
    return this.prisma.admission.findUnique({ where: { studentId: student.id }, include: draftInclude });
  }

  // Staff review action. APPROVED issues ukssuId — only allowed once the
  // admission fee is paid, and idempotent (double-click / retry safe: an
  // already-issued ukssuId is reused, not regenerated). REJECTED (or any
  // other status) has no side effects beyond the status fields.
  async updateStatus(id: string, status: AdmissionStatus, reviewedBy: string) {
    const admission = await this.prisma.admission.findUnique({
      where: { id },
      include: { student: { include: { user: true } } },
    });
    if (!admission) throw new NotFoundException("Admission not found");

    if (status === "APPROVED") {
      if (!admission.paid) {
        throw new BadRequestException("Cannot approve an admission that hasn't paid the admission fee");
      }
      return this.prisma.$transaction(async (tx) => {
        let ukssuId = admission.student.user.ukssuId;
        if (!ukssuId) {
          ukssuId = await this.ukssu.nextId(tx, Role.STUDENT);
          await tx.user.update({ where: { id: admission.student.userId }, data: { ukssuId } });
        }
        return tx.admission.update({ where: { id }, data: { status, reviewedAt: new Date(), reviewedBy } });
      });
    }

    return this.prisma.admission.update({
      where: { id },
      data: { status, reviewedAt: new Date(), reviewedBy },
    });
  }

  // --- Batches -------------------------------------------------------

  getActiveBatch() {
    return this.prisma.admissionBatch.findFirst({ where: { isActive: true } });
  }

  listBatches() {
    return this.prisma.admissionBatch.findMany({ orderBy: { startedAt: "desc" } });
  }

  // Activating a batch deactivates all others in the same transaction — only
  // one batch is ever open for new admissions at a time.
  async createBatch(dto: CreateBatchDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.admissionBatch.updateMany({ where: { isActive: true }, data: { isActive: false } });
      return tx.admissionBatch.create({ data: { label: dto.label, isActive: true } });
    });
  }

  // Closes admissions entirely — no batch is active until staff/admin starts
  // a new one. New draft admissions can't be created in the meantime
  // (getOrCreateDraft 400s with "not currently open"); in-progress drafts
  // tied to this batch are untouched and can still be paid/completed.
  async closeBatch(id: string) {
    const batch = await this.prisma.admissionBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException("Batch not found");
    if (!batch.isActive) throw new ConflictException("This batch is not currently active");
    return this.prisma.admissionBatch.update({ where: { id }, data: { isActive: false } });
  }

  // --- Draft admission (dashboard 5-step form) ------------------------

  // Get-or-create: the draft is created the moment the applicant first opens
  // the admission form, tied to whichever batch is currently active. Lets
  // the wizard resume where the applicant left off across visits.
  async getOrCreateDraft(userId: string) {
    const student = await this.students.findByUserId(userId);
    const existing = await this.prisma.admission.findUnique({ where: { studentId: student.id }, include: draftInclude });
    if (existing) return existing;

    const activeBatch = await this.getActiveBatch();
    if (!activeBatch) throw new BadRequestException("Admissions are not currently open");

    const created = await this.prisma.admission.create({
      data: { studentId: student.id, batchId: activeBatch.id },
    });
    return this.prisma.admission.findUniqueOrThrow({ where: { id: created.id }, include: draftInclude });
  }

  private async getEditableDraft(userId: string) {
    const student = await this.students.findByUserId(userId);
    const admission = await this.prisma.admission.findUnique({ where: { studentId: student.id } });
    if (!admission) throw new NotFoundException("Admission draft not found — start the admission form first");
    if (admission.paid) throw new ConflictException("This admission is already complete and can no longer be edited");
    return admission;
  }

  async patchDraft(userId: string, dto: PatchDraftAdmissionDto) {
    const admission = await this.getEditableDraft(userId);

    if (dto.personal) {
      const { courseId, ...admissionFields } = dto.personal;
      if (Object.keys(admissionFields).length > 0) {
        await this.prisma.admission.update({ where: { id: admission.id }, data: admissionFields });
      }
      if (courseId) {
        const course = await this.prisma.course.findUnique({ where: { id: courseId } });
        if (!course) throw new BadRequestException("Unknown course");
        await this.prisma.student.update({
          where: { id: admission.studentId },
          data: { programme: course.name, programmeLevel: course.level },
        });
      }
    }
    if (dto.parent) {
      await this.prisma.parentDetails.upsert({
        where: { admissionId: admission.id },
        create: { admissionId: admission.id, ...dto.parent },
        update: dto.parent,
      });
    }
    if (dto.address) {
      await this.prisma.addressDetails.upsert({
        where: { admissionId: admission.id },
        create: { admissionId: admission.id, ...dto.address },
        update: dto.address,
      });
    }
    if (dto.academic) {
      await this.prisma.academicDetails.upsert({
        where: { admissionId: admission.id },
        create: { admissionId: admission.id, ...dto.academic },
        update: dto.academic,
      });
    }
    if (dto.sports) {
      await this.prisma.sportsDetails.upsert({
        where: { admissionId: admission.id },
        create: { admissionId: admission.id, ...dto.sports },
        update: dto.sports,
      });
    }

    return this.prisma.admission.findUniqueOrThrow({ where: { id: admission.id }, include: draftInclude });
  }

  // Replaces any existing document of the same type — the dashboard UI calls
  // this "Replace", not "add another", so one row per (admission, type).
  async uploadDocument(userId: string, type: string, file: { buffer: Buffer; originalname: string; mimetype: string }) {
    if (!Object.values(DocumentType).includes(type as DocumentType)) {
      throw new BadRequestException(`Unknown document type: ${type}`);
    }
    // The frontend's file picker only accepts pdf/jpg/png as a UI hint — this
    // is the actual enforcement, since a client can send any mimetype.
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Only PDF, JPG, and PNG files are accepted");
    }
    const admission = await this.getEditableDraft(userId);

    const stored = await this.storage.store(`admissions/${admission.id}`, file.originalname, file.buffer, file.mimetype);

    await this.prisma.document.deleteMany({ where: { admissionId: admission.id, type: type as DocumentType } });
    await this.prisma.document.create({
      data: {
        admissionId: admission.id,
        type: type as DocumentType,
        filename: file.originalname,
        ...(stored.kind === "azure" ? { url: stored.url } : { data: stored.data, mimeType: stored.mimeType }),
      },
    });

    return this.prisma.admission.findUniqueOrThrow({ where: { id: admission.id }, include: draftInclude });
  }

  async deleteDocument(userId: string, documentId: string) {
    const admission = await this.getEditableDraft(userId);
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.admissionId !== admission.id) throw new NotFoundException("Document not found");

    await this.prisma.document.delete({ where: { id: documentId } });
    return this.prisma.admission.findUniqueOrThrow({ where: { id: admission.id }, include: draftInclude });
  }

  // Read access only — deliberately NOT gated on `!paid` (unlike
  // getEditableDraft) since applicants should still be able to view/download
  // their own documents after admission is complete, just not edit them.
  async getDocumentFile(userId: string, documentId: string) {
    const student = await this.students.findByUserId(userId);
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException("Document not found");
    const admission = await this.prisma.admission.findUnique({ where: { id: doc.admissionId } });
    if (!admission || admission.studentId !== student.id) throw new NotFoundException("Document not found");
    return doc.url ? { ...doc, url: this.storage.getReadUrl(doc.url) } : doc;
  }

  // Staff/admin review access — no ownership check, gated by role at the controller.
  async getDocumentFileForStaff(documentId: string) {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException("Document not found");
    return doc.url ? { ...doc, url: this.storage.getReadUrl(doc.url) } : doc;
  }

  // Official form: ₹1,000 for UR/OBC-NCL/EWS, ₹500 for SC/ST/PwD. Unset or
  // unrecognized category falls back to the full rate.
  private feeForCategory(category: string | null): number {
    const concession = category === "SC" || category === "ST" || category === "PwD";
    return this.config.get<number>(concession ? "razorpay.admissionFeeConcessionPaise" : "razorpay.admissionFeeFullPaise")!;
  }

  async createDraftPaymentOrder(userId: string, declarationAccepted: boolean) {
    if (!declarationAccepted) {
      throw new BadRequestException("You must accept the declaration before paying the admission fee");
    }
    const admission = await this.getEditableDraft(userId);
    const amount = this.feeForCategory(admission.category);
    const receipt = `adm_${Date.now()}`;

    let order: Awaited<ReturnType<PaymentsService["createOrder"]>>;
    try {
      order = await this.payments.createOrder(amount, receipt);
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 401) throw new UnauthorizedException("Payment provider authentication failed");
      throw new InternalServerErrorException("Could not reach the payment provider. Please try again.");
    }

    await this.prisma.admission.update({
      where: { id: admission.id },
      data: { razorpayOrderId: order.id, declarationAcceptedAt: new Date() },
    });

    return {
      razorpayOrderId: order.id,
      razorpayKeyId: this.config.get<string>("razorpay.keyId"),
      amount: order.amount,
    };
  }

  // Finalizes the admission: marks it paid/complete. Does NOT issue ukssuId —
  // that only happens once staff APPROVE the admission (updateStatus above),
  // after the offline written + physical test.
  async verifyDraftPayment(userId: string, paymentId: string, signature: string) {
    const student = await this.students.findByUserId(userId);
    const admission = await this.prisma.admission.findUnique({ where: { studentId: student.id } });
    if (!admission) throw new NotFoundException("Admission draft not found");
    if (admission.paid) return { paid: true };
    if (!admission.razorpayOrderId) throw new BadRequestException("No payment has been initiated for this admission");

    const valid = this.payments.verifyCheckoutSignature(admission.razorpayOrderId, paymentId, signature);
    if (!valid) throw new UnauthorizedException("Payment signature verification failed");

    await this.markPaidByOrderId(admission.razorpayOrderId, paymentId);
    return { paid: true };
  }

  // Authoritative confirmation path — called from the Razorpay webhook
  // (payment.captured) rather than the client. Exists so a payment still
  // gets recorded even if the applicant's browser dies/loses connection
  // right after paying, before the client-side verify-payment call lands.
  // Looked up by razorpayOrderId since that's all the webhook payload has.
  async handlePaymentCaptured(orderId: string, paymentId: string) {
    await this.markPaidByOrderId(orderId, paymentId);
  }

  // Shared by both confirmation paths above. Idempotent (re-checks `paid`
  // inside the transaction) so whichever of client-verify/webhook arrives
  // first wins and the second is a no-op — no double-charge bookkeeping.
  // Silently ignores an unknown orderId (e.g. a webhook for an order that
  // isn't an admission fee order) rather than erroring.
  private async markPaidByOrderId(orderId: string, paymentId: string) {
    const justPaid = await this.prisma.$transaction(async (tx) => {
      const admission = await tx.admission.findUnique({ where: { razorpayOrderId: orderId } });
      if (!admission || admission.paid) return null;

      const amount = this.feeForCategory(admission.category);
      await tx.admission.update({
        where: { id: admission.id },
        data: { paid: true, razorpayPaymentId: paymentId, amountPaid: amount, paidAt: new Date() },
      });

      const student = await tx.student.findUnique({
        where: { id: admission.studentId },
        include: { user: { select: { email: true, fullName: true, registrationNumber: true } } },
      });
      return student ? { user: student.user, amount } : null;
    });

    // Sent outside the transaction so a slow/failed email can never hold the
    // DB transaction open or roll back the payment record.
    if (justPaid) {
      await this.mail.sendAdmissionPaymentConfirmed({
        to: justPaid.user.email,
        fullName: justPaid.user.fullName,
        registrationNumber: justPaid.user.registrationNumber,
        amountPaidPaise: justPaid.amount,
        paymentId,
      });
    }
  }
}
