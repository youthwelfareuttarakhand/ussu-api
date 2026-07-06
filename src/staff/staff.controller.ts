import { Controller, Get, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { StaffService } from "./staff.service";

@Controller("staff")
@UseGuards(RolesGuard)
export class StaffController {
  constructor(private staff: StaffService) {}

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.staff.findAll();
  }
}
