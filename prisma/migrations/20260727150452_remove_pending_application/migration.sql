-- DropForeignKey
ALTER TABLE "PendingApplication" DROP CONSTRAINT "PendingApplication_courseId_fkey";

-- DropTable
DROP TABLE "PendingApplication";

-- DropEnum
DROP TYPE "PaymentStatus";

