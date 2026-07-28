const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const studentCount = await prisma.student.count();
  console.log("student.count():", studentCount);

  try {
    const rows = await prisma.student.findMany({
      orderBy: { user: { registrationNumber: "desc" } },
      include: {
        user: { select: { id: true, email: true, registrationNumber: true } },
        admission: { select: { id: true, paid: true, status: true } },
      },
    });
    console.log("findAllRegistrations() equivalent rows:", rows.length);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error("QUERY FAILED:", e);
  }
}

main()
  .catch((e) => {
    console.error("SCRIPT FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
