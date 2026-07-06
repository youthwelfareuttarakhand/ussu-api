import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StudentsService } from "../students/students.service";
import type { CreateAdmissionDto } from "./dto/create-admission.dto";
import type { AdmissionStatus, Prisma } from "@prisma/client";

@Injectable()
export class AdmissionsService {
  constructor(
    private prisma: PrismaService,
    private students: StudentsService,
  ) {}

  findAll() {
    return this.prisma.admission.findMany({ orderBy: { submittedAt: "desc" } });
  }

  async findForUser(userId: string) {
    const student = await this.students.findByUserId(userId);
    return this.prisma.admission.findUnique({ where: { studentId: student.id } });
  }

  async createForUser(userId: string, dto: CreateAdmissionDto) {
    const student = await this.students.findByUserId(userId);
    return this.prisma.admission.create({
      data: { studentId: student.id, formData: dto.formData as Prisma.InputJsonValue },
    });
  }

  async updateStatus(id: string, status: AdmissionStatus, reviewedBy: string) {
    const admission = await this.prisma.admission.findUnique({ where: { id } });
    if (!admission) throw new NotFoundException("Admission not found");
    return this.prisma.admission.update({
      where: { id },
      data: { status, reviewedAt: new Date(), reviewedBy },
    });
  }
}
