-- AlterTable
ALTER TABLE "AdmissionBatch" ADD COLUMN     "examCentreAddress" TEXT,
ADD COLUMN     "examCentreName" TEXT,
ADD COLUMN     "examDate" TIMESTAMP(3),
ADD COLUMN     "reportingTime" TEXT;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "code" TEXT;

-- CreateTable
CREATE TABLE "RollNumberCounter" (
    "year" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RollNumberCounter_pkey" PRIMARY KEY ("year","courseCode")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

