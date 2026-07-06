import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../auth/strategies/jwt.strategy";
import { AdmissionsService } from "./admissions.service";
import { CreateAdmissionDto } from "./dto/create-admission.dto";
import { UpdateAdmissionStatusDto } from "./dto/update-admission-status.dto";

@Controller("admissions")
@UseGuards(RolesGuard)
export class AdmissionsController {
  constructor(private admissions: AdmissionsService) {}

  @Get()
  @Roles(Role.STAFF, Role.ADMIN)
  findAll() {
    return this.admissions.findAll();
  }

  @Get("me")
  @Roles(Role.STUDENT)
  findMine(@CurrentUser() user: AuthUser) {
    return this.admissions.findForUser(user.sub);
  }

  @Post("me")
  @Roles(Role.STUDENT)
  createMine(@CurrentUser() user: AuthUser, @Body() dto: CreateAdmissionDto) {
    return this.admissions.createForUser(user.sub, dto);
  }

  @Patch(":id/status")
  @Roles(Role.STAFF, Role.ADMIN)
  updateStatus(@Param("id") id: string, @Body() dto: UpdateAdmissionStatusDto, @CurrentUser() user: AuthUser) {
    return this.admissions.updateStatus(id, dto.status, user.email);
  }
}
