-- DropIndex
DROP INDEX "FeePayment_razorpayOrderId_key";

-- CreateIndex
CREATE INDEX "FeePayment_razorpayOrderId_idx" ON "FeePayment"("razorpayOrderId");
