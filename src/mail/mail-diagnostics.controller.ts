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
    const domains = await client.domains.list();
    const template = await client.templates.get("admission-fee-confirmation");

    return {
      apiKeySet: true,
      from,
      domains: domains.data,
      domainsError: domains.error,
      template: template.data,
      templateError: template.error,
    };
  }
}
