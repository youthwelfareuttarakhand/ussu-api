// Diagnostic: why did some paid admissions not get a roll number backfilled?
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admissions = await prisma.admission.findMany({
    where: { paid: true, student: { rollNumber: null } },
    include: { student: true },
  });
  console.log(`${admissions.length} paid admissions still without a roll number.`);

  const byProgramme = new Map<string, number>();
  for (const a of admissions) {
    const key = a.student.programme ?? "(null)";
    byProgramme.set(key, (byProgramme.get(key) ?? 0) + 1);
  }
  console.log("Breakdown by Student.programme value:");
  for (const [programme, count] of byProgramme) {
    const course = programme === "(null)" ? null : await prisma.course.findUnique({ where: { name: programme } });
    console.log(`  "${programme}" x${count} -> course row: ${course ? JSON.stringify(course) : "NOT FOUND"}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
