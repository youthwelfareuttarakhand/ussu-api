import { Module } from "@nestjs/common";
import { UkssuService } from "./ukssu.service";
import { RegistrationNumberService } from "./registration-number.service";

@Module({
  providers: [UkssuService, RegistrationNumberService],
  exports: [UkssuService, RegistrationNumberService],
})
export class UkssuModule {}
