import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReferenceService {
  constructor(private prisma: PrismaService) {}

  getCourses() {
    return this.prisma.course.findMany({
      select: { id: true, name: true, level: true },
      orderBy: { name: "asc" },
    });
  }

  getActiveBatch() {
    return this.prisma.admissionBatch.findFirst({
      where: { isActive: true },
      select: { id: true, label: true },
    });
  }

  getCountries() {
    return this.prisma.country.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  }

  getStates(countryId: string | undefined) {
    if (!countryId) return [];
    return this.prisma.state.findMany({ where: { countryId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  }

  getReligions() {
    return this.prisma.religion.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  }
}
