-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "data" BYTEA,
ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT,
ALTER COLUMN "url" DROP NOT NULL;

