-- AlterTable
ALTER TABLE "Notice" ADD COLUMN     "attachmentData" BYTEA,
ADD COLUMN     "attachmentFilename" TEXT,
ADD COLUMN     "attachmentMimeType" TEXT,
ADD COLUMN     "attachmentUrl" TEXT;
