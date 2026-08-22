// Prod's actual Diploma course was named "Sports Coaching", not "Diploma in
// Sports Coaching" (what seed.ts/the first backfill assumed) — so the first
// course-code backfill created a separate, unused duplicate row (with code
// "DSC" already set) instead of updating the real one. This deletes that
// duplicate, then renames the real row to "Diploma in Sports Coaching" (the
// correct/intended name) and sets its code, and updates every Student whose
// snapshotted `programme` string said the old name so future course lookups
// (by name) keep matching.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OLD_NAME = "Sports Coaching";
const NEW_NAME = "Diploma in Sports Coaching";

async function main() {
  const studentsOnDuplicate = await prisma.student.count({ where: { programme: NEW_NAME } });
  if (studentsOnDuplicate === 0) {
    const deleted = await prisma.course.deleteMany({ where: { name: NEW_NAME } });
    console.log(`Removed ${deleted.count} unused duplicate course row(s) named "${NEW_NAME}".`);
  } else {
    console.log(`Skipped deleting "${NEW_NAME}" — ${studentsOnDuplicate} student(s) already reference it.`);
  }

  const real = await prisma.course.update({
    where: { name: OLD_NAME },
    data: { name: NEW_NAME, code: "DSC" },
  });
  console.log("Renamed + coded the real course row:", real);

  const updated = await prisma.student.updateMany({
    where: { programme: OLD_NAME },
    data: { programme: NEW_NAME },
  });
  console.log(`Updated ${updated.count} Student row(s) from programme "${OLD_NAME}" to "${NEW_NAME}".`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
