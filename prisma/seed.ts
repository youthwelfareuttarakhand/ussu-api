import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { COUNTRIES } from "./data/countries";

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

  const admin = await prisma.user.upsert({
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

  const staffUser = await prisma.user.upsert({
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
      student: { create: { rollNumber: "USSU2026001", programme: "B.P.Ed", district: "DEHRADUN" } },
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
      { name: "B.Sc. Sports Science", level: "UG" as const },
      { name: "B.Sc. Sports Management", level: "UG" as const },
      { name: "B.Sc. Sports Journalism", level: "UG" as const },
      { name: "Sports Coaching", level: "DIPLOMA" as const },
    ].map((course) =>
      prisma.course.upsert({
        where: { name: course.name },
        update: {},
        create: course,
      }),
    ),
  );

  await prisma.notice.createMany({
    data: [
      { title: "Admissions open for 2026-27", body: "Applications for all programmes are now open.", postedBy: admin.email },
      { title: "Sports Conclave 2026 highlights", body: "Photos and results from the recent conclave are now live.", postedBy: staffUser.email },
    ],
    skipDuplicates: true,
  });

  await prisma.country.createMany({
    data: COUNTRIES.map((name) => ({ name })),
    skipDuplicates: true,
  });

  await prisma.religion.createMany({
    data: RELIGIONS.map((name) => ({ name })),
    skipDuplicates: true,
  });

  console.log("Seeded admin, staff, student users, sample notices, countries, and religions.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
