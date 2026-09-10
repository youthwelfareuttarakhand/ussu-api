// One-off script: switches "Diploma in Sports Coaching" tuition from year-wise
// (₹45,100 / "Year 1") to semester-wise (₹27,000 / "Semester 1"), matching the
// UG courses. The hostel fee stays year-wise.
//
// Students who already PAID tuition as "Year 1" are left untouched — they keep
// showing "Year 1" / Paid and are never re-charged (FeesService falls back to
// any paid row). Unpaid "Year 1" leftovers are relabelled to "Semester 1".
//
// Safe to run against production; idempotent. Run once with:
//   npx ts-node prisma/diploma-semester-tuition.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COURSE_NAME = "Diploma in Sports Coaching";

async function main() {
  const course = await prisma.course.findUnique({ where: { name: COURSE_NAME } });
  if (!course) {
    console.log(`No "${COURSE_NAME}" Course row — nothing to do.`);
    return;
  }

  const tuition = await prisma.feeStructure.upsert({
    where: { courseId_label: { courseId: course.id, label: "Tuition Fee" } },
    update: { cadence: "SEMESTER", amountPaise: 2700000 },
    create: {
      courseId: course.id,
      label: "Tuition Fee",
      cadence: "SEMESTER",
      amountPaise: 2700000,
      mandatory: true,
      requiresHostelOptIn: false,
    },
  });
  console.log(`Tuition Fee → SEMESTER / ₹27,000 (structure ${tuition.id}).`);

  const kept = await prisma.feePayment.count({
    where: { feeStructureId: tuition.id, paid: true, cycleLabel: "Year 1" },
  });
  const relabelled = await prisma.feePayment.updateMany({
    where: { feeStructureId: tuition.id, paid: false, cycleLabel: "Year 1" },
    data: { cycleLabel: "Semester 1" },
  });
  console.log(`Paid "Year 1" tuition rows kept as-is: ${kept}.`);
  console.log(`Unpaid "Year 1" tuition rows relabelled to "Semester 1": ${relabelled.count}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
