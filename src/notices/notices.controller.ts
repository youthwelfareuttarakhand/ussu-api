import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../auth/strategies/jwt.strategy";
import { NoticesService } from "./notices.service";
import { CreateNoticeDto } from "./dto/create-notice.dto";

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

  @Get()
  @Roles(Role.STUDENT, Role.STAFF, Role.ADMIN)
  findAll() {
    return this.notices.findAll();
  }

  @Post()
  @Roles(Role.STAFF, Role.ADMIN)
  create(@Body() dto: CreateNoticeDto, @CurrentUser() user: AuthUser) {
    return this.notices.create(dto.title, dto.body, user.email);
  }
}
