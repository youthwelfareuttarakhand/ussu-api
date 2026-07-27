import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { RegistrationNumberService } from "../ukssu/registration-number.service";
import { CreateApplicationDto } from "./dto/create-application.dto";

@Injectable()
export class ApplicationsService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private registrationNumbers: RegistrationNumberService,
  ) {}

  // Signup is free — no payment, no pending/holding row. Creates the real
  // account synchronously and logs the applicant in immediately.
  async create(dto: CreateApplicationDto, res: Response) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new BadRequestException("Unknown course");
    if (course.level !== dto.programme) {
      throw new BadRequestException("Selected course does not belong to the selected programme");
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { phone: dto.phone }] },
    });
    if (existingUser) {
      throw new ConflictException(
        existingUser.email === dto.email ? "Email already registered" : "Phone already registered",
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const registrationNumber = await this.registrationNumbers.nextNumber(tx);
      // ukssuId is intentionally left unset here — registering is not the
      // same as being admitted. It's issued later, once staff APPROVE the
      // applicant's paid admission (AdmissionsService.updateStatus). No
      // Admission row is created here either — that happens get-or-create,
      // the moment the applicant starts the dashboard admission form.
      return tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          role: Role.STUDENT,
          fullName: dto.fullName,
          dob: new Date(dto.dob),
          registrationNumber,
          student: {
            create: {
              programme: course.name,
              district: dto.district,
              programmeLevel: dto.programme,
            },
          },
        },
      });
    });

    await this.auth.issueAndSetCookies(res, user);

    return { registrationNumber: user.registrationNumber, fullName: user.fullName, email: user.email };
  }
}
