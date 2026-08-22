import { Module } from "@nestjs/common";
import { UkssuService } from "./ukssu.service";
import { RegistrationNumberService } from "./registration-number.service";
import { RollNumberService } from "./roll-number.service";

@Module({
  providers: [UkssuService, RegistrationNumberService, RollNumberService],
  exports: [UkssuService, RegistrationNumberService, RollNumberService],
})
export class UkssuModule {}
