import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { StudentsService } from "./students.service";
import { UpdateStudentDto } from "./dto/update-student.dto";

@Controller("students")
@UseGuards(RolesGuard)
export class StudentsController {
  constructor(private students: StudentsService) {}

  @Get()
  @Roles(Role.STAFF, Role.ADMIN)
  findAll() {
    return this.students.findAll();
  }

  @Patch(":id")
  @Roles(Role.STAFF, Role.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateStudentDto) {
    return this.students.update(id, dto);
  }
}
