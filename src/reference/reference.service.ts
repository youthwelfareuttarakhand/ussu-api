import { Injectable } from "@nestjs/common";
import { District } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Display labels for the District enum. Kept in code next to the enum rather
// than in the DB — see docs/DATABASE.md.
const DISTRICT_LABELS: Record<District, string> = {
  ALMORA: "Almora",
  BAGESHWAR: "Bageshwar",
  CHAMOLI: "Chamoli",
  CHAMPAWAT: "Champawat",
  DEHRADUN: "Dehradun",
  HARIDWAR: "Haridwar",
  NAINITAL: "Nainital",
  PAURI_GARHWAL: "Pauri Garhwal",
  PITHORAGARH: "Pithoragarh",
  RUDRAPRAYAG: "Rudraprayag",
  TEHRI_GARHWAL: "Tehri Garhwal",
  UDHAM_SINGH_NAGAR: "Udham Singh Nagar",
  UTTARKASHI: "Uttarkashi",
};

@Injectable()
export class ReferenceService {
  constructor(private prisma: PrismaService) {}

  getDistricts() {
    return (Object.keys(DISTRICT_LABELS) as District[]).map((value) => ({
      value,
      label: DISTRICT_LABELS[value],
    }));
  }

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

  getReligions() {
    return this.prisma.religion.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  }
}
