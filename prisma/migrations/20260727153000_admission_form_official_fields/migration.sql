-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'SPORTS_CERTIFICATE';
ALTER TYPE "DocumentType" ADD VALUE 'MEDICAL_FITNESS_CERTIFICATE';
ALTER TYPE "DocumentType" ADD VALUE 'GRADUATION_CERTIFICATE';

-- AlterTable
ALTER TABLE "AcademicDetails" DROP COLUMN "tenthSchool",
DROP COLUMN "twelfthSchool",
ADD COLUMN     "gapYear" BOOLEAN,
ADD COLUMN     "graduationDiscipline" TEXT,
ADD COLUMN     "graduationInstitution" TEXT,
ADD COLUMN     "graduationPercentage" DOUBLE PRECISION,
ADD COLUMN     "graduationYear" INTEGER,
ADD COLUMN     "tenthRollNo" TEXT,
ADD COLUMN     "twelfthStream" TEXT;

-- AlterTable
ALTER TABLE "AddressDetails" DROP COLUMN "correspondenceCity",
DROP COLUMN "correspondenceLine1",
DROP COLUMN "correspondenceLine2",
DROP COLUMN "correspondencePincode",
DROP COLUMN "correspondenceState",
DROP COLUMN "permanentCity",
DROP COLUMN "permanentLine1",
DROP COLUMN "permanentLine2",
DROP COLUMN "permanentPincode",
DROP COLUMN "permanentState",
DROP COLUMN "sameAsPermanent",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "line1" TEXT,
ADD COLUMN     "line2" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "Admission" DROP COLUMN "disability",
DROP COLUMN "religion",
DROP COLUMN "residingInIndia",
ADD COLUMN     "coachingDiscipline" TEXT,
ADD COLUMN     "declarationAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "hostelRequired" BOOLEAN,
ADD COLUMN     "mediumOfInstruction" TEXT,
ADD COLUMN     "uttarakhandDomicile" BOOLEAN;

-- AlterTable
ALTER TABLE "ParentDetails" ADD COLUMN     "guardianName" TEXT;

-- CreateTable
CREATE TABLE "SportsDetails" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "primarySport" TEXT,
    "highestLevel" TEXT,
    "positionHeld" TEXT,
    "certifyingAuthority" TEXT,
    "yearOfAchievement" INTEGER,
    "eminentSportsperson" BOOLEAN,

    CONSTRAINT "SportsDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SportsDetails_admissionId_key" ON "SportsDetails"("admissionId");

-- AddForeignKey
ALTER TABLE "SportsDetails" ADD CONSTRAINT "SportsDetails_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
