import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "@prisma/client";
import type { PaginatedListQueryDto, PaginatedResult } from "../common/dto/paginated-list-query.dto";
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

  // Only students with an assigned UKSSU ID show up here — matches the
  // portal's "Students" list intent (enrolled students), not every applicant
  // who merely paid but hasn't been approved yet. Paginated server-side —
  // this used to fetch every match, unbounded, on every page load.
  async findAll(query: PaginatedListQueryDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.StudentWhereInput = { user: { ukssuId: { not: null } } };
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: { user: { select: this.userSelect }, admission: { select: { id: true } } },
        ...(query.all ? {} : { skip: (page - 1) * limit, take: limit }),
      }),
      this.prisma.student.count({ where }),
    ]);
    return { data, total };
  }

  // Every registered applicant, regardless of admission/payment progress —
  // the portal's "Registrations" list (distinct from "Students", which is
  // paid-only, and "Admissions Queue", which is submitted-application-only).
  // Paginated + course/gender/discipline-filterable server-side, same reason
  // as findAll above.
  async findAllRegistrations(query: PaginatedListQueryDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.StudentWhereInput = {
      ...(query.course ? { programme: query.course } : {}),
      ...(query.gender ? { admission: { gender: query.gender } } : {}),
      ...(query.discipline ? { admission: { coachingDiscipline: query.discipline } } : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy: { user: { registrationNumber: "desc" } },
        include: {
          user: { select: this.userSelect },
          admission: { select: { id: true, paid: true, status: true, coachingDiscipline: true, gender: true } },
        },
        ...(query.all ? {} : { skip: (page - 1) * limit, take: limit }),
      }),
      this.prisma.student.count({ where }),
    ]);
    return { data, total };
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
