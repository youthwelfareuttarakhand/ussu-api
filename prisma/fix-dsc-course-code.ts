// Prod's actual Diploma course is named "Sports Coaching", not "Diploma in
// Sports Coaching" (what prisma/seed.ts and the initial backfill assumed) —
// so the course-code backfill created a *separate*, unused duplicate row
// instead of updating the real one, and every real DSC student's course
// lookup (by Student.programme, which holds "Sports Coaching") kept finding
// code: null. This sets the code on the real row and removes the duplicate.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const real = await prisma.course.update({
    where: { name: "Sports Coaching" },
    data: { code: "DSC" },
  });
  console.log("Updated real course row:", real);

  const studentsOnDuplicate = await prisma.student.count({ where: { programme: "Diploma in Sports Coaching" } });
  if (studentsOnDuplicate === 0) {
    const deleted = await prisma.course.deleteMany({ where: { name: "Diploma in Sports Coaching" } });
    console.log(`Removed ${deleted.count} unused duplicate course row(s).`);
  } else {
    console.log(`Left duplicate row in place — ${studentsOnDuplicate} student(s) actually reference it.`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
