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

interface ContactNotificationParams {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

const CONTACT_NOTIFICATION_TO = "admissions@ukssu.ac.in";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
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

  // Plain HTML send (not Resend's Template API) — deliberate: a template
  // needs to be created and published in the Resend dashboard first, which
  // caused real friction for the payment-confirmation template. A contact
  // notification ships without any external setup this way.
  async sendContactNotification(params: ContactNotificationParams) {
    if (!this.client) {
      this.logger.warn(`RESEND_API_KEY not set — skipping contact notification from ${params.email}`);
      return;
    }

    const html = `
      <p><strong>New contact form submission</strong></p>
      <p><strong>Name:</strong> ${escapeHtml(params.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(params.email)}</p>
      ${params.phone ? `<p><strong>Phone:</strong> ${escapeHtml(params.phone)}</p>` : ""}
      ${params.subject ? `<p><strong>Subject:</strong> ${escapeHtml(params.subject)}</p>` : ""}
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(params.message).replace(/\n/g, "<br />")}</p>
    `;

    try {
      const result = await this.client.emails.send({
        from: this.from,
        to: CONTACT_NOTIFICATION_TO,
        replyTo: params.email,
        subject: `Contact Form: ${params.subject ?? "General Enquiry"} — ${params.name}`,
        html,
      });
      if (result.error) {
        this.logger.error(`Resend rejected contact notification from ${params.email}: ${JSON.stringify(result.error)}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send contact notification from ${params.email}`, err instanceof Error ? err.stack : String(err));
    }
  }
}
