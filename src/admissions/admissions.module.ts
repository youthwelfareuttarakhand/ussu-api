import { Module } from "@nestjs/common";
import { AdmissionsController } from "./admissions.controller";
import { AdmissionsService } from "./admissions.service";
import { StudentsModule } from "../students/students.module";
import { UkssuModule } from "../ukssu/ukssu.module";
import { PaymentsModule } from "../payments/payments.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [StudentsModule, UkssuModule, PaymentsModule, StorageModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
})
export class AdmissionsModule {}
