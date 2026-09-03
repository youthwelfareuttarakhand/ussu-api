import { Module } from "@nestjs/common";
import { NoticesController } from "./notices.controller";
import { NoticesService } from "./notices.service";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [StorageModule],
  controllers: [NoticesController],
  providers: [NoticesService],
})
export class NoticesModule {}
