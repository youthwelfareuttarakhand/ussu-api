-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PAID', 'FAILED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "District" AS ENUM ('ALMORA', 'BAGESHWAR', 'CHAMOLI', 'CHAMPAWAT', 'DEHRADUN', 'HARIDWAR', 'NAINITAL', 'PAURI_GARHWAL', 'PITHORAGARH', 'RUDRAPRAYAG', 'TEHRI_GARHWAL', 'UDHAM_SINGH_NAGAR', 'UTTARKASHI');

-- CreateEnum
CREATE TYPE "ProgrammeLevel" AS ENUM ('UG', 'PG', 'DIPLOMA');

-- AlterTable
-- fullName/ukssuId added nullable first so existing rows can be backfilled
-- before the NOT NULL constraint is applied below.
ALTER TABLE "User" ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "ukssuId" TEXT;

-- Backfill existing rows (this migration only ever runs once against rows
-- that predate the admissions/UKSSU-ID flow — real applicants always get a
-- proper UKSSU-<year>-<roleCode>-<seq> id at creation time).
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt") AS rn
  FROM "User"
  WHERE "ukssuId" IS NULL
)
UPDATE "User" u
SET
  "fullName" = COALESCE(u."fullName", INITCAP(REPLACE(SPLIT_PART(u."email", '@', 1), '.', ' '))),
  "ukssuId" = COALESCE(u."ukssuId", 'UKSSU-2026-SEED-' || LPAD(numbered.rn::text, 6, '0'))
FROM numbered
WHERE u."id" = numbered."id";

ALTER TABLE "User" ALTER COLUMN "fullName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "ukssuId" SET NOT NULL;

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "ProgrammeLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingApplication" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "district" "District" NOT NULL,
    "programme" "ProgrammeLevel" NOT NULL,
    "courseId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "createdUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UkssuIdCounter" (
    "year" INTEGER NOT NULL,
    "roleCode" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UkssuIdCounter_pkey" PRIMARY KEY ("year","roleCode")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_name_key" ON "Course"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PendingApplication_razorpayOrderId_key" ON "PendingApplication"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "PendingApplication_email_idx" ON "PendingApplication"("email");

-- CreateIndex
CREATE INDEX "PendingApplication_phone_idx" ON "PendingApplication"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_ukssuId_key" ON "User"("ukssuId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- AddForeignKey
ALTER TABLE "PendingApplication" ADD CONSTRAINT "PendingApplication_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

