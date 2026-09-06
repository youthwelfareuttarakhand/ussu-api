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

  // A student's fee status is derived, not stored: "NA" if their course has
  // no fee structure (or the only structure is a hostel fee they didn't opt
  // into — nothing owed), else PAID/PARTIAL/UNPAID by comparing paid
  // FeePayment rows against the course's applicable (mandatory-for-them)
  // FeeStructure rows.
  private deriveFeeStatus(
    courseId: string | null,
    hostelRequired: boolean | null,
    payments: { feeStructureId: string; paid: boolean }[],
    structuresByCourse: Map<string, { id: string; requiresHostelOptIn: boolean }[]>,
  ): "PAID" | "PARTIAL" | "UNPAID" | "NA" {
    if (!courseId) return "NA";
    const structures = structuresByCourse.get(courseId) ?? [];
    const applicable = structures.filter((s) => !s.requiresHostelOptIn || hostelRequired);
    if (applicable.length === 0) return "NA";

    const paidIds = new Set(payments.filter((p) => p.paid).map((p) => p.feeStructureId));
    const paidCount = applicable.filter((s) => paidIds.has(s.id)).length;
    if (paidCount === applicable.length) return "PAID";
    if (paidCount === 0) return "UNPAID";
    return "PARTIAL";
  }

  // Only students with an assigned UKSSU ID show up here — matches the
  // portal's "Students" list intent (enrolled students), not every applicant
  // who merely paid but hasn't been approved yet. Paginated server-side —
  // this used to fetch every match, unbounded, on every page load.
  async findAll(query: PaginatedListQueryDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.StudentWhereInput = { user: { ukssuId: { not: null } } };

    const feeStructures = await this.prisma.feeStructure.findMany({
      select: { id: true, courseId: true, requiresHostelOptIn: true },
    });
    const structuresByCourse = new Map<string, { id: string; requiresHostelOptIn: boolean }[]>();
    for (const s of feeStructures) {
      structuresByCourse.set(s.courseId, [...(structuresByCourse.get(s.courseId) ?? []), s]);
    }

    // Fee status is computed in app code, not a DB column, so filtering by it
    // needs a first lightweight pass over every matching student (id/course/
    // hostel/payments only, no joins) to resolve which ids match — the
    // student table is small enough (one university's enrollment) for this
    // to be cheap; revisit with a materialized column if that stops being true.
    if (query.feeStatus) {
      const candidates = await this.prisma.student.findMany({
        where,
        select: {
          id: true,
          courseId: true,
          admission: { select: { hostelRequired: true } },
          feePayments: { select: { feeStructureId: true, paid: true } },
        },
      });
      const matchingIds = candidates
        .filter((c) => this.deriveFeeStatus(c.courseId, c.admission?.hostelRequired ?? null, c.feePayments, structuresByCourse) === query.feeStatus)
        .map((c) => c.id);
      where.id = { in: matchingIds };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: {
          user: { select: this.userSelect },
          admission: { select: { id: true, hostelRequired: true } },
          feePayments: { select: { feeStructureId: true, paid: true } },
        },
        ...(query.all ? {} : { skip: (page - 1) * limit, take: limit }),
      }),
      this.prisma.student.count({ where }),
    ]);

    const decorated = data.map((student) => ({
      ...student,
      feeStatus: this.deriveFeeStatus(student.courseId, student.admission?.hostelRequired ?? null, student.feePayments, structuresByCourse),
    }));

    return { data: decorated, total };
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
