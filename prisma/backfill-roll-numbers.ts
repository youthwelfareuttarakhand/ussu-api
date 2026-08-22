// One-time backfill: assigns roll numbers to admissions that were already
// submitted+paid before the roll-number feature existed (AdmissionsService
// only assigns one going forward, at payment time). Ordered by submittedAt
// ascending per course so sequence numbers reflect real submission order.
// Run with: npx ts-node prisma/backfill-roll-numbers.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function nextRollNumber(courseCode: string): Promise<string> {
  const year = new Date().getFullYear();
  const yy = String(year).slice(-2);
  let value: number;
  try {
    const row = await prisma.rollNumberCounter.update({
      where: { year_courseCode: { year, courseCode } },
      data: { value: { increment: 1 } },
    });
    value = row.value;
  } catch {
    const row = await prisma.rollNumberCounter.create({ data: { year, courseCode, value: 1 } });
    value = row.value;
  }
  return `${yy}${courseCode}${String(value).padStart(6, "0")}`;
}

async function main() {
  const admissions = await prisma.admission.findMany({
    where: { paid: true, student: { rollNumber: null } },
    orderBy: { submittedAt: "asc" },
    include: { student: true },
  });

  let assigned = 0;
  for (const admission of admissions) {
    if (!admission.student.programme) continue;
    const course = await prisma.course.findUnique({ where: { name: admission.student.programme } });
    if (!course?.code) continue;

    const rollNumber = await nextRollNumber(course.code);
    await prisma.student.update({ where: { id: admission.studentId }, data: { rollNumber } });
    assigned++;
    console.log(`${admission.student.id} -> ${rollNumber}`);
  }

  console.log(`Backfilled ${assigned} roll number(s) out of ${admissions.length} eligible admission(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
