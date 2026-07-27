import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UkssuModule } from "../ukssu/ukssu.module";
import { ApplicationsController } from "./applications.controller";
import { ApplicationsService } from "./applications.service";

@Module({
  imports: [AuthModule, UkssuModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
