-- Payment groups: combined share payments (NHL-PG) and combined-share kisti
-- agreements (NHL-K). Separate sequences per reference series — a share sale
-- never advances the kisti or payment-group counters. Additive only.

CREATE SEQUENCE "kisti_uid_seq";
CREATE SEQUENCE "payment_group_uid_seq";

-- CreateEnum
CREATE TYPE "PaymentGroupKind" AS ENUM ('INSTANT', 'KISTI');

-- CreateTable
CREATE TABLE "PaymentGroup" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "refSequence" INTEGER NOT NULL,
    "investorId" TEXT NOT NULL,
    "kind" "PaymentGroupKind" NOT NULL,
    "shareCount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "slipFileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGroup_ref_key" ON "PaymentGroup"("ref");
CREATE UNIQUE INDEX "PaymentGroup_refSequence_key" ON "PaymentGroup"("refSequence");
CREATE INDEX "PaymentGroup_investorId_idx" ON "PaymentGroup"("investorId");

-- Group membership: which shares belong to a payment group / kisti agreement.
ALTER TABLE "Investment" ADD COLUMN "paymentGroupId" TEXT;
ALTER TABLE "InvestmentRequest" ADD COLUMN "paymentGroupId" TEXT;

-- Kistis of a combined-share agreement belong to the group; legacy per-share
-- kistis keep their investment link (column becomes optional).
ALTER TABLE "InstallmentSchedule" ALTER COLUMN "investmentId" DROP NOT NULL;
ALTER TABLE "InstallmentSchedule" ADD COLUMN "paymentGroupId" TEXT;

-- AddForeignKey
ALTER TABLE "PaymentGroup" ADD CONSTRAINT "PaymentGroup_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_paymentGroupId_fkey" FOREIGN KEY ("paymentGroupId") REFERENCES "PaymentGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvestmentRequest" ADD CONSTRAINT "InvestmentRequest_paymentGroupId_fkey" FOREIGN KEY ("paymentGroupId") REFERENCES "PaymentGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstallmentSchedule" ADD CONSTRAINT "InstallmentSchedule_paymentGroupId_fkey" FOREIGN KEY ("paymentGroupId") REFERENCES "PaymentGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Investment_paymentGroupId_idx" ON "Investment"("paymentGroupId");
CREATE INDEX "InvestmentRequest_paymentGroupId_idx" ON "InvestmentRequest"("paymentGroupId");
CREATE INDEX "InstallmentSchedule_paymentGroupId_idx" ON "InstallmentSchedule"("paymentGroupId");
