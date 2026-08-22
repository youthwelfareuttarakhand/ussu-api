import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { Role } from "@prisma/client";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../auth/strategies/jwt.strategy";
import { PaymentsService } from "../payments/payments.service";
import { AdmissionsService } from "./admissions.service";
import { PaginatedListQueryDto } from "../common/dto/paginated-list-query.dto";
import { AdmitCardService } from "./admit-card.service";
import { CreateBatchDto } from "./dto/create-batch.dto";
import { UpdateBatchExamDetailsDto } from "./dto/update-batch-exam-details.dto";
import { PatchDraftAdmissionDto } from "./dto/patch-draft-admission.dto";
import { PayDraftDto } from "./dto/pay-draft.dto";
import { UpdateAdmissionStatusDto } from "./dto/update-admission-status.dto";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

@Controller("admissions")
@UseGuards(RolesGuard)
export class AdmissionsController {
  constructor(
    private admissions: AdmissionsService,
    private admitCards: AdmitCardService,
  ) {}

  @Get()
  @Roles(Role.STAFF, Role.ADMIN)
  findAll(@Query() query: PaginatedListQueryDto) {
    return this.admissions.findAll(query);
  }

  @Get("me")
  @Roles(Role.STUDENT)
  findMine(@CurrentUser() user: AuthUser) {
    return this.admissions.findForUser(user.sub);
  }

  @Patch(":id/status")
  @Roles(Role.STAFF, Role.ADMIN)
  updateStatus(@Param("id") id: string, @Body() dto: UpdateAdmissionStatusDto, @CurrentUser() user: AuthUser) {
    return this.admissions.updateStatus(id, dto.status, user.email);
  }

  @Get("me/admit-card")
  @Roles(Role.STUDENT)
  async downloadMyAdmitCard(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const pdf = await this.admitCards.generateForUser(user.sub);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="admit-card.pdf"');
    res.send(pdf);
  }

  @Get("batches")
  @Roles(Role.STAFF, Role.ADMIN)
  listBatches() {
    return this.admissions.listBatches();
  }

  @Post("batches")
  @Roles(Role.STAFF, Role.ADMIN)
  createBatch(@Body() dto: CreateBatchDto) {
    return this.admissions.createBatch(dto);
  }

  // Closes the active batch WITHOUT opening a new one — admissions are fully
  // closed until staff/admin starts the next batch. Distinct from
  // createBatch, which always leaves exactly one batch open.
  @Patch("batches/:id/close")
  @Roles(Role.STAFF, Role.ADMIN)
  closeBatch(@Param("id") id: string) {
    return this.admissions.closeBatch(id);
  }

  @Patch("batches/:id/exam-details")
  @Roles(Role.STAFF, Role.ADMIN)
  updateBatchExamDetails(@Param("id") id: string, @Body() dto: UpdateBatchExamDetailsDto) {
    return this.admissions.updateBatchExamDetails(id, dto);
  }

  @Get("draft")
  @Roles(Role.STUDENT)
  getDraft(@CurrentUser() user: AuthUser) {
    return this.admissions.getOrCreateDraft(user.sub);
  }

  @Patch("draft")
  @Roles(Role.STUDENT)
  patchDraft(@CurrentUser() user: AuthUser, @Body() dto: PatchDraftAdmissionDto) {
    return this.admissions.patchDraft(user.sub, dto);
  }

  @Post("draft/documents")
  @Roles(Role.STUDENT)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_DOCUMENT_BYTES } }))
  uploadDocument(
    @CurrentUser() user: AuthUser,
    @Body("type") type: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file was uploaded");
    return this.admissions.uploadDocument(user.sub, type, file);
  }

  @Delete("draft/documents/:id")
  @Roles(Role.STUDENT)
  deleteDocument(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.admissions.deleteDocument(user.sub, id);
  }

  @Get("draft/documents/:id/file")
  @Roles(Role.STUDENT)
  async getDocumentFile(@CurrentUser() user: AuthUser, @Param("id") id: string, @Res() res: Response) {
    const doc = await this.admissions.getDocumentFile(user.sub, id);
    if (doc.url) return res.redirect(doc.url);
    if (!doc.data) throw new BadRequestException("Document has no stored content");
    res.setHeader("Content-Type", doc.mimeType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${doc.filename}"`);
    res.send(Buffer.from(doc.data));
  }

  @Post("draft/pay")
  @Roles(Role.STUDENT)
  payDraft(@CurrentUser() user: AuthUser, @Body() dto: PayDraftDto) {
    return this.admissions.createDraftPaymentOrder(user.sub, dto.declarationAccepted);
  }

  @Post("draft/verify-payment")
  @Roles(Role.STUDENT)
  verifyDraftPayment(@CurrentUser() user: AuthUser, @Body() dto: VerifyPaymentDto) {
    return this.admissions.verifyDraftPayment(user.sub, dto.razorpayPaymentId, dto.razorpaySignature);
  }

  @Get(":id/documents/:docId/file")
  @Roles(Role.STAFF, Role.ADMIN)
  async getDocumentFileForStaff(
    @Param("docId") docId: string,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const doc = await this.admissions.getDocumentFileForStaff(docId);
    const disposition = download ? "attachment" : "inline";
    if (doc.url) return res.redirect(doc.url);
    if (!doc.data) throw new BadRequestException("Document has no stored content");
    res.setHeader("Content-Type", doc.mimeType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `${disposition}; filename="${doc.filename}"`);
    res.send(Buffer.from(doc.data));
  }

  @Get(":id/admit-card")
  @Roles(Role.STAFF, Role.ADMIN)
  async downloadAdmitCardForStaff(@Param("id") id: string, @Res() res: Response) {
    const pdf = await this.admitCards.generateForAdmissionId(id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="admit-card.pdf"');
    res.send(pdf);
  }

  // Declared last — a wildcard :id GET would otherwise shadow the static
  // "me"/"batches"/"draft" routes above if placed earlier.
  @Get(":id")
  @Roles(Role.STAFF, Role.ADMIN)
  findOne(@Param("id") id: string) {
    return this.admissions.findOne(id);
  }
}

// Separate controller (different route prefix) so this module stays the
// single owner of the payment-confirmation logic without a generic
// "payments" module needing to depend back on admissions.
@Controller("payments/webhook")
export class PaymentsWebhookController {
  constructor(
    private payments: PaymentsService,
    private admissions: AdmissionsService,
  ) {}

  @Post("razorpay")
  @Public()
  async handleRazorpayWebhook(@Req() req: RawBodyRequest<Request>, @Headers("x-razorpay-signature") signature: string) {
    if (!req.rawBody || !signature) throw new UnauthorizedException("Missing webhook signature");
    if (!this.payments.verifyWebhookSignature(req.rawBody, signature)) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    const event = req.body;
    if (event?.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (payment?.order_id && payment?.id) {
        await this.admissions.handlePaymentCaptured(payment.order_id, payment.id);
      }
    }

    return { ok: true };
  }
}
