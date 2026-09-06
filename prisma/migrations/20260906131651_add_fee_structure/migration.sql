-- CreateEnum
CREATE TYPE "FeeCadence" AS ENUM ('SEMESTER', 'YEAR');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "courseId" TEXT;

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cadence" "FeeCadence" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePayment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "cycleLabel" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_courseId_label_key" ON "FeeStructure"("courseId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_razorpayOrderId_key" ON "FeePayment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_studentId_feeStructureId_cycleLabel_key" ON "FeePayment"("studentId", "feeStructureId", "cycleLabel");

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
