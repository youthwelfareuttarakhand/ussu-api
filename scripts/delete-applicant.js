const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// One-off: remove a single test applicant's data from prod completely.
const TARGET_EMAIL = "aroraarryan@gmail.com";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: { student: { include: { admission: true } } },
  });

  if (!user) {
    console.log(`No user found for ${TARGET_EMAIL} — nothing to do.`);
    return;
  }

  console.log("Found user:", { id: user.id, email: user.email, registrationNumber: user.registrationNumber });

  const admissionId = user.student?.admission?.id;

  if (admissionId) {
    console.log("Deleting admission-linked records for admission:", admissionId);
    await prisma.document.deleteMany({ where: { admissionId } });
    await prisma.parentDetails.deleteMany({ where: { admissionId } });
    await prisma.addressDetails.deleteMany({ where: { admissionId } });
    await prisma.academicDetails.deleteMany({ where: { admissionId } });
    await prisma.sportsDetails.deleteMany({ where: { admissionId } });
    await prisma.admission.delete({ where: { id: admissionId } });
  }

  if (user.student) {
    await prisma.student.delete({ where: { id: user.student.id } });
  }

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log(`Deleted user ${TARGET_EMAIL} and all linked records.`);
}

main()
  .catch((e) => {
    console.error("SCRIPT FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
