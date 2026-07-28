import { Module } from "@nestjs/common";
import { MailService } from "./mail.service";
import { MailDiagnosticsController } from "./mail-diagnostics.controller";

@Module({
  controllers: [MailDiagnosticsController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
