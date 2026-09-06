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

// Fills in a 7-day trend from one grouped SQL query's rows instead of one
// count() query per day (was 7 separate round trips per trend, 14 total
// across overview()+visitors() on a single admin dashboard load).
function fillTrend(days: { start: Date; label: string }[], rows: { day: Date; count: bigint }[]) {
  const countByDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));
  return days.map(({ start, label }) => ({ day: label, count: countByDay.get(start.toISOString().slice(0, 10)) ?? 0 }));
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  recordVisit(path: string, ip: string) {
    return this.prisma.pageVisit.create({ data: { path, ip } });
  }

  async overview() {
    const [totalRegistrations, admissionsCompleted, totalStudents, totalStaff] = await Promise.all([
      this.prisma.student.count(),
      this.prisma.admission.count({ where: { paid: true } }),
      this.prisma.student.count({ where: { user: { ukssuId: { not: null } } } }),
      this.prisma.staff.count(),
    ]);
    // Pending = every student who hasn't completed admission yet, including those who haven't
    // started the admission form at all (no Admission row), not just unpaid Admission rows.
    const pendingAdmissions = totalRegistrations - admissionsCompleted;

    const days = last7Days();
    const rows = await this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") as day, count(*)::bigint as count
      FROM "User"
      WHERE role = 'STUDENT' AND "createdAt" >= ${days[0].start}
      GROUP BY date_trunc('day', "createdAt")
    `;
    const registrationTrend = fillTrend(days, rows);

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
    const rows = await this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") as day, count(DISTINCT ip)::bigint as count
      FROM "PageVisit"
      WHERE "createdAt" >= ${days[0].start}
      GROUP BY date_trunc('day', "createdAt")
    `;
    const trend = fillTrend(days, rows);

    return { totalUnique, last7Days: last7Days_, thisMonth, thisYear, trend };
  }

  private async uniqueIpCount(where: Prisma.PageVisitWhereInput) {
    const rows = await this.prisma.pageVisit.findMany({ where, distinct: ["ip"], select: { ip: true } });
    return rows.length;
  }
}
