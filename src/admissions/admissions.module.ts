import { Module } from "@nestjs/common";
import { AdmissionsController, PaymentsWebhookController } from "./admissions.controller";
import { AdmissionsService } from "./admissions.service";
import { AdmitCardService } from "./admit-card.service";
import { StudentsModule } from "../students/students.module";
import { UkssuModule } from "../ukssu/ukssu.module";
import { PaymentsModule } from "../payments/payments.module";
import { StorageModule } from "../storage/storage.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [StudentsModule, UkssuModule, PaymentsModule, StorageModule, MailModule],
  controllers: [AdmissionsController, PaymentsWebhookController],
  providers: [AdmissionsService, AdmitCardService],
})
export class AdmissionsModule {}
