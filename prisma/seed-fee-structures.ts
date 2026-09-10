// One-off script: seeds ONLY FeeStructure rows for existing courses.
// Unlike prisma/seed.ts (which also upserts sample admin/staff/student test
// accounts using fixed emails/phones), this touches nothing else — safe to
// run against a database that already holds real production users.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const feeStructuresByCourse: Record<
  string,
  { label: string; cadence: "YEAR" | "SEMESTER"; amountPaise: number; mandatory: boolean; requiresHostelOptIn: boolean }[]
> = {
  "Bachelor of Sports Science": [
    { label: "Tuition Fee", cadence: "SEMESTER", amountPaise: 2870000, mandatory: true, requiresHostelOptIn: false },
    { label: "Hostel Fee", cadence: "SEMESTER", amountPaise: 550000, mandatory: false, requiresHostelOptIn: true },
  ],
  "Bachelor of Sports Management": [
    { label: "Tuition Fee", cadence: "SEMESTER", amountPaise: 2870000, mandatory: true, requiresHostelOptIn: false },
    { label: "Hostel Fee", cadence: "SEMESTER", amountPaise: 550000, mandatory: false, requiresHostelOptIn: true },
  ],
  "Bachelor of Sports Journalism": [
    { label: "Tuition Fee", cadence: "SEMESTER", amountPaise: 2870000, mandatory: true, requiresHostelOptIn: false },
    { label: "Hostel Fee", cadence: "SEMESTER", amountPaise: 550000, mandatory: false, requiresHostelOptIn: true },
  ],
  // Tuition is billed per semester (₹27,000 / Semester 1); the hostel fee stays per year.
  "Diploma in Sports Coaching": [
    { label: "Tuition Fee", cadence: "SEMESTER", amountPaise: 2700000, mandatory: true, requiresHostelOptIn: false },
    { label: "Hostel Fee", cadence: "YEAR", amountPaise: 1400000, mandatory: false, requiresHostelOptIn: true },
  ],
};

async function main() {
  for (const [courseName, fees] of Object.entries(feeStructuresByCourse)) {
    const course = await prisma.course.findUnique({ where: { name: courseName } });
    if (!course) {
      console.log(`Skipping "${courseName}" — no matching Course row found.`);
      continue;
    }
    for (const fee of fees) {
      await prisma.feeStructure.upsert({
        where: { courseId_label: { courseId: course.id, label: fee.label } },
        update: { cadence: fee.cadence, amountPaise: fee.amountPaise, mandatory: fee.mandatory, requiresHostelOptIn: fee.requiresHostelOptIn },
        create: { courseId: course.id, ...fee },
      });
      console.log(`Upserted ${courseName} — ${fee.label}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
