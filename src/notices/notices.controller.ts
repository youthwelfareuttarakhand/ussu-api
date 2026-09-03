import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../auth/strategies/jwt.strategy";
import { NoticesService } from "./notices.service";
import { CreateNoticeDto } from "./dto/create-notice.dto";
import { UpdateNoticeDto } from "./dto/update-notice.dto";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

@Controller("notices")
@UseGuards(RolesGuard)
export class NoticesController {
  constructor(private notices: NoticesService) {}

  /** Unauthenticated, for the public homepage notice ticker. */
  @Get("public")
  @Public()
  findPublic() {
    return this.notices.findAll();
  }

  /** Unauthenticated, so the notice's PDF/image link works from the public homepage too. */
  @Get(":id/attachment")
  @Public()
  async getAttachment(@Param("id") id: string, @Res() res: Response) {
    const attachment = await this.notices.getAttachment(id);
    if (attachment.url) return res.redirect(attachment.url);
    res.setHeader("Content-Type", attachment.mimeType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${attachment.filename}"`);
    res.send(Buffer.from(attachment.data!));
  }

  @Get()
  @Roles(Role.STUDENT, Role.STAFF, Role.ADMIN)
  findAll() {
    return this.notices.findAll();
  }

  @Post()
  @Roles(Role.STAFF, Role.ADMIN)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  create(@Body() dto: CreateNoticeDto, @CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    return this.notices.create(dto.title, dto.body, user.email, file);
  }

  @Patch(":id")
  @Roles(Role.STAFF, Role.ADMIN)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  update(@Param("id") id: string, @Body() dto: UpdateNoticeDto, @UploadedFile() file?: Express.Multer.File) {
    if (!dto.title && !dto.body && !file) throw new BadRequestException("Nothing to update");
    return this.notices.update(id, dto, file);
  }

  @Delete(":id")
  @Roles(Role.STAFF, Role.ADMIN)
  async remove(@Param("id") id: string) {
    await this.notices.remove(id);
    return { success: true };
  }
}
