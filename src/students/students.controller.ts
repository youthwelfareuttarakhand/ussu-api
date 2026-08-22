import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../auth/strategies/jwt.strategy";
import { StudentsService } from "./students.service";
import { UpdateStudentDto } from "./dto/update-student.dto";
import { PaginatedListQueryDto } from "../common/dto/paginated-list-query.dto";

@Controller("students")
@UseGuards(RolesGuard)
export class StudentsController {
  constructor(private students: StudentsService) {}

  @Get()
  @Roles(Role.STAFF, Role.ADMIN)
  findAll(@Query() query: PaginatedListQueryDto) {
    return this.students.findAll(query);
  }

  @Get("registrations")
  @Roles(Role.STAFF, Role.ADMIN)
  findAllRegistrations(@Query() query: PaginatedListQueryDto) {
    return this.students.findAllRegistrations(query);
  }

  @Get("me")
  @Roles(Role.STUDENT)
  findMine(@CurrentUser() user: AuthUser) {
    return this.students.findByUserId(user.sub);
  }

  @Patch(":id")
  @Roles(Role.STAFF, Role.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateStudentDto) {
    return this.students.update(id, dto);
  }
}
