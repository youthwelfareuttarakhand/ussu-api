import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function last7Days(): { start: Date; end: Date; label: string }[] {
  const days: { start: Date; end: Date; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const start = new Date(today.getTime() - i * DAY_MS);
    const end = new Date(start.getTime() + DAY_MS);
    days.push({ start, end, label: WEEKDAY_LABELS[start.getDay()] });
  }
  return days;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  recordVisit(path: string, ip: string) {
    return this.prisma.pageVisit.create({ data: { path, ip } });
  }

  async overview() {
    const [totalRegistrations, admissionsCompleted, pendingAdmissions, totalStudents, totalStaff] = await Promise.all([
      this.prisma.admission.count(),
      this.prisma.admission.count({ where: { paid: true } }),
      this.prisma.admission.count({ where: { paid: false } }),
      this.prisma.student.count({ where: { user: { ukssuId: { not: null } } } }),
      this.prisma.staff.count(),
    ]);

    const days = last7Days();
    const registrationTrend = await Promise.all(
      days.map(async ({ start, end, label }) => ({
        day: label,
        count: await this.prisma.admission.count({ where: { submittedAt: { gte: start, lt: end } } }),
      })),
    );

    return { totalRegistrations, admissionsCompleted, pendingAdmissions, totalStudents, totalStaff, registrationTrend };
  }

  async visitors() {
    const now = new Date();
    const startOfWeek = new Date(now.getTime() - 7 * DAY_MS);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [totalUnique, last7Days_, thisMonth, thisYear] = await Promise.all([
      this.uniqueIpCount({}),
      this.uniqueIpCount({ createdAt: { gte: startOfWeek } }),
      this.uniqueIpCount({ createdAt: { gte: startOfMonth } }),
      this.uniqueIpCount({ createdAt: { gte: startOfYear } }),
    ]);

    const days = last7Days();
    const trend = await Promise.all(
      days.map(async ({ start, end, label }) => ({
        day: label,
        count: await this.uniqueIpCount({ createdAt: { gte: start, lt: end } }),
      })),
    );

    return { totalUnique, last7Days: last7Days_, thisMonth, thisYear, trend };
  }

  private async uniqueIpCount(where: Prisma.PageVisitWhereInput) {
    const rows = await this.prisma.pageVisit.findMany({ where, distinct: ["ip"], select: { ip: true } });
    return rows.length;
  }
}
