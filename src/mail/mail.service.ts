import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

interface AdmissionPaymentConfirmedParams {
  to: string;
  fullName: string;
  registrationNumber: string | null;
  amountPaidPaise: number;
  paymentId: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>("mail.resendApiKey");
    this.client = apiKey ? new Resend(apiKey) : null;
    this.from = this.config.get<string>("mail.fromAddress")!;
  }

  // Fire-and-forget from the caller's perspective: payment is already
  // recorded in the DB by the time this runs, so a mail failure must never
  // roll back or block the payment-confirmation response — just log it.
  async sendAdmissionPaymentConfirmed(params: AdmissionPaymentConfirmedParams) {
    if (!this.client) {
      this.logger.warn(`RESEND_API_KEY not set — skipping payment confirmation email to ${params.to}`);
      return;
    }

    const amountRupees = (params.amountPaidPaise / 100).toFixed(2);

    try {
      const result = await this.client.emails.send({
        from: this.from,
        to: params.to,
        subject: "Payment Successful — USSU Admission Application Complete",
        template: {
          id: "admission-fee-confirmation",
          variables: {
            fullName: params.fullName,
            amountPaid: amountRupees,
            paymentId: params.paymentId,
            registrationNumber: params.registrationNumber ?? "—",
          },
        },
      });
      // Resend resolves normally (doesn't throw) on API-level failures like
      // an invalid/misconfigured template — the error only shows up here.
      if (result.error) {
        this.logger.error(`Resend rejected payment confirmation email to ${params.to}: ${JSON.stringify(result.error)}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send payment confirmation email to ${params.to}`, err instanceof Error ? err.stack : String(err));
    }
  }
}
