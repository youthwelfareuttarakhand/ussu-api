-- AlterTable
ALTER TABLE "User" ADD COLUMN     "registrationNumber" TEXT;

-- CreateTable
CREATE TABLE "RegistrationNumberCounter" (
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RegistrationNumberCounter_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_registrationNumber_key" ON "User"("registrationNumber");

