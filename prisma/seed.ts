import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { COUNTRIES } from "./data/countries";
import { INDIA_STATES } from "./data/india-states";

const RELIGIONS = [
  "Hinduism",
  "Islam",
  "Christianity",
  "Sikhism",
  "Buddhism",
  "Jainism",
  "Judaism",
  "Zoroastrianism",
  "Atheist / No Religion",
  "Other",
];

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "admin@ukssu.ac.in" },
    update: { fullName: "USSU Administrator", ukssuId: "UKSSU-2026-ADM-000001" },
    create: {
      email: "admin@ukssu.ac.in",
      passwordHash,
      role: "ADMIN",
      fullName: "USSU Administrator",
      ukssuId: "UKSSU-2026-ADM-000001",
    },
  });

  await prisma.user.upsert({
    where: { email: "staff@ukssu.ac.in" },
    update: { fullName: "Admissions Officer", ukssuId: "UKSSU-2026-STF-000001" },
    create: {
      email: "staff@ukssu.ac.in",
      passwordHash,
      role: "STAFF",
      fullName: "Admissions Officer",
      ukssuId: "UKSSU-2026-STF-000001",
      staff: { create: { department: "Admissions", designation: "Officer" } },
    },
  });

  await prisma.country.createMany({
    data: COUNTRIES.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const india = await prisma.country.findUniqueOrThrow({ where: { name: "India" } });

  await prisma.state.createMany({
    data: INDIA_STATES.map((name) => ({ name, countryId: india.id })),
    skipDuplicates: true,
  });

  const uttarakhand = await prisma.state.findFirstOrThrow({ where: { countryId: india.id, name: "Uttarakhand" } });

  const studentUser = await prisma.user.upsert({
    where: { email: "student@ukssu.ac.in" },
    update: {
      fullName: "Sample Student",
      ukssuId: "UKSSU-2026-STU-000001",
      phone: "9999999999",
      dob: new Date("2006-04-15"),
    },
    create: {
      email: "student@ukssu.ac.in",
      passwordHash,
      role: "STUDENT",
      fullName: "Sample Student",
      ukssuId: "UKSSU-2026-STU-000001",
      phone: "9999999999",
      dob: new Date("2006-04-15"),
      student: { create: { rollNumber: "USSU2026001", programme: "B.P.Ed", countryId: india.id, stateId: uttarakhand.id } },
    },
    include: { student: true },
  });

  const batch = await prisma.admissionBatch.upsert({
    where: { label: "2026-2027" },
    update: { isActive: true },
    create: { label: "2026-2027", isActive: true },
  });

  const student = await prisma.student.findUnique({ where: { userId: studentUser.id } });
  if (student) {
    await prisma.admission.upsert({
      where: { studentId: student.id },
      update: {},
      create: {
        studentId: student.id,
        batchId: batch.id,
        status: "UNDER_REVIEW",
        paid: true,
      },
    });
  }

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

  // Official prospectus rates, 2026-27: UG courses are billed per semester,
  // the Diploma per year.
  const feeStructuresByCourse: Record<string, { label: string; cadence: "YEAR" | "SEMESTER"; amountPaise: number; mandatory: boolean; requiresHostelOptIn: boolean }[]> = {
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
    "Diploma in Sports Coaching": [
      { label: "Tuition Fee", cadence: "YEAR", amountPaise: 4510000, mandatory: true, requiresHostelOptIn: false },
      { label: "Hostel Fee", cadence: "YEAR", amountPaise: 1400000, mandatory: false, requiresHostelOptIn: true },
    ],
  };

  for (const [courseName, fees] of Object.entries(feeStructuresByCourse)) {
    const course = await prisma.course.findUnique({ where: { name: courseName } });
    if (!course) continue;
    await Promise.all(
      fees.map((fee) =>
        prisma.feeStructure.upsert({
          where: { courseId_label: { courseId: course.id, label: fee.label } },
          update: { cadence: fee.cadence, amountPaise: fee.amountPaise, mandatory: fee.mandatory, requiresHostelOptIn: fee.requiresHostelOptIn },
          create: { courseId: course.id, ...fee },
        }),
      ),
    );
  }

  await prisma.religion.createMany({
    data: RELIGIONS.map((name) => ({ name })),
    skipDuplicates: true,
  });

  console.log("Seeded admin, staff, student users, countries, India's states, and religions.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
