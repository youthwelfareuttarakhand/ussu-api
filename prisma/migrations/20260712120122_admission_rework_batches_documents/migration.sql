-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PHOTO', 'SIGNATURE', 'MARKSHEET_10', 'MARKSHEET_12', 'AADHAR', 'CATEGORY_CERTIFICATE', 'OTHER');

-- AlterTable
ALTER TABLE "Admission" DROP COLUMN "formData",
ADD COLUMN     "aadharNumber" TEXT,
ADD COLUMN     "amountPaid" INTEGER,
ADD COLUMN     "batchId" TEXT NOT NULL,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "disability" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "razorpayOrderId" TEXT,
ADD COLUMN     "razorpayPaymentId" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "residingInIndia" BOOLEAN,
ADD COLUMN     "tshirtSize" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "district" "District";

-- CreateTable
CREATE TABLE "AdmissionBatch" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentDetails" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "fatherName" TEXT,
    "motherName" TEXT,
    "guardianPhone" TEXT,
    "guardianEmail" TEXT,
    "occupation" TEXT,

    CONSTRAINT "ParentDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressDetails" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "permanentLine1" TEXT,
    "permanentLine2" TEXT,
    "permanentCity" TEXT,
    "permanentState" TEXT,
    "permanentPincode" TEXT,
    "sameAsPermanent" BOOLEAN NOT NULL DEFAULT true,
    "correspondenceLine1" TEXT,
    "correspondenceLine2" TEXT,
    "correspondenceCity" TEXT,
    "correspondenceState" TEXT,
    "correspondencePincode" TEXT,

    CONSTRAINT "AddressDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicDetails" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "tenthBoard" TEXT,
    "tenthSchool" TEXT,
    "tenthYear" INTEGER,
    "tenthPercentage" DOUBLE PRECISION,
    "twelfthBoard" TEXT,
    "twelfthSchool" TEXT,
    "twelfthYear" INTEGER,
    "twelfthPercentage" DOUBLE PRECISION,

    CONSTRAINT "AcademicDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionBatch_label_key" ON "AdmissionBatch"("label");

-- CreateIndex
CREATE UNIQUE INDEX "ParentDetails_admissionId_key" ON "ParentDetails"("admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AddressDetails_admissionId_key" ON "AddressDetails"("admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicDetails_admissionId_key" ON "AcademicDetails"("admissionId");

-- CreateIndex
CREATE INDEX "Document_admissionId_idx" ON "Document"("admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_razorpayOrderId_key" ON "Admission"("razorpayOrderId");

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AdmissionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentDetails" ADD CONSTRAINT "ParentDetails_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressDetails" ADD CONSTRAINT "AddressDetails_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicDetails" ADD CONSTRAINT "AcademicDetails_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

