import { Controller, Get, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";

// TEMPORARY — diagnosing why payment-confirmation emails aren't sending.
// Remove after use.
@Controller("mail-diagnostics")
@UseGuards(RolesGuard)
export class MailDiagnosticsController {
  constructor(private config: ConfigService) {}

  @Get()
  @Roles(Role.ADMIN)
  async diagnose() {
    const apiKey = this.config.get<string>("mail.resendApiKey");
    const from = this.config.get<string>("mail.fromAddress");
    if (!apiKey) return { apiKeySet: false, from };

    const client = new Resend(apiKey);
    const result = await client.emails.send({
      from: from!,
      to: "admin@ukssu.ac.in",
      subject: "Payment Successful — USSU Admission Application Complete",
      template: {
        id: "admission-fee-confirmation",
        variables: {
          fullName: "Diagnostic Test",
          amountPaid: "1000.00",
          paymentId: "test_diagnostic",
          registrationNumber: "REG-TEST-000000",
        },
      },
    });

    return { apiKeySet: true, from, data: result.data, error: result.error };
  }
}
