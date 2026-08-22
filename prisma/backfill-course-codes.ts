// One-time backfill: sets Course.code on prod's existing 4 course rows
// (added by the admit-card migration, but not populated by it — only
// `prisma db seed` sets it, and CI doesn't run seed on deploy). Upsert-only,
// matches prisma/seed.ts's course block exactly — touches nothing else.
// Run with: npx ts-node prisma/backfill-course-codes.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await Promise.all(
    [
      { name: "Bachelor of Sports Science", level: "UG" as const, code: "BSS" },
      { name: "Bachelor of Sports Management", level: "UG" as const, code: "BSM" },
      { name: "Bachelor of Sports Journalism", level: "UG" as const, code: "BSJ" },
      { name: "Diploma in Sports Coaching", level: "DIPLOMA" as const, code: "DSC" },
    ].map((course) =>
      prisma.course.upsert({
        where: { name: course.name },
        update: { code: course.code },
        create: course,
      }),
    ),
  );
  console.log("Course codes backfilled.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
