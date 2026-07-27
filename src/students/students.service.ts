import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateStudentDto } from "./dto/update-student.dto";

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  private readonly userSelect = {
    id: true,
    email: true,
    role: true,
    ukssuId: true,
    fullName: true,
    registrationNumber: true,
    phone: true,
    dob: true,
  } as const;

  // Only students who've actually completed admission (paid) show up here —
  // matches the portal's "Students" list intent (enrolled students), not
  // every applicant who merely registered or started the admission form.
  findAll() {
    return this.prisma.student.findMany({
      where: { admission: { paid: true } },
      include: { user: { select: this.userSelect }, admission: { select: { id: true } } },
    });
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
