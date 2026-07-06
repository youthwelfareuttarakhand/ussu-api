import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateStudentDto } from "./dto/update-student.dto";

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  private readonly userSelect = { id: true, email: true, role: true } as const;

  findAll() {
    return this.prisma.student.findMany({ include: { user: { select: this.userSelect } } });
  }

  async findByUserId(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: { select: this.userSelect } },
    });
    if (!student) throw new NotFoundException("Student profile not found");
    return student;
  }

  async update(id: string, dto: UpdateStudentDto) {
    return this.prisma.student.update({ where: { id }, data: dto });
  }
}
