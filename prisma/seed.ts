import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@ukssu.ac.in" },
    update: {},
    create: { email: "admin@ukssu.ac.in", passwordHash, role: "ADMIN" },
  });

  const staffUser = await prisma.user.upsert({
    where: { email: "staff@ukssu.ac.in" },
    update: {},
    create: {
      email: "staff@ukssu.ac.in",
      passwordHash,
      role: "STAFF",
      staff: { create: { department: "Admissions", designation: "Officer" } },
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: "student@ukssu.ac.in" },
    update: {},
    create: {
      email: "student@ukssu.ac.in",
      passwordHash,
      role: "STUDENT",
      student: { create: { rollNumber: "USSU2026001", programme: "B.P.Ed" } },
    },
    include: { student: true },
  });

  const student = await prisma.student.findUnique({ where: { userId: studentUser.id } });
  if (student) {
    await prisma.admission.upsert({
      where: { studentId: student.id },
      update: {},
      create: {
        studentId: student.id,
        status: "UNDER_REVIEW",
        formData: { programme: "B.P.Ed", previousSchool: "Govt. Inter College" },
      },
    });
  }

  await prisma.notice.createMany({
    data: [
      { title: "Admissions open for 2026-27", body: "Applications for all programmes are now open.", postedBy: admin.email },
      { title: "Sports Conclave 2026 highlights", body: "Photos and results from the recent conclave are now live.", postedBy: staffUser.email },
    ],
    skipDuplicates: true,
  });

  console.log("Seeded admin, staff, student users + sample notices.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
