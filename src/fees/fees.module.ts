import { Module } from "@nestjs/common";
import { FeesController } from "./fees.controller";
import { FeesService } from "./fees.service";
import { StudentsModule } from "../students/students.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [StudentsModule, PaymentsModule],
  controllers: [FeesController],
  providers: [FeesService],
  exports: [FeesService],
})
export class FeesModule {}
