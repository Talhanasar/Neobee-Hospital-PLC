-- "Payment done" requests: investors report an offline payment (installment or
-- share payment) toward an existing investment; staff verify and approve, which
-- records a DEPOSIT ledger Transaction. New subscriptions stay SHARE_PURCHASE.

-- CreateEnum
CREATE TYPE "RequestKind" AS ENUM ('SHARE_PURCHASE', 'PAYMENT');

-- AlterTable
ALTER TABLE "InvestmentRequest" ADD COLUMN     "kind" "RequestKind" NOT NULL DEFAULT 'SHARE_PURCHASE',
ADD COLUMN     "targetInvestmentId" TEXT;

-- CreateIndex
CREATE INDEX "InvestmentRequest_targetInvestmentId_idx" ON "InvestmentRequest"("targetInvestmentId");

-- AddForeignKey
ALTER TABLE "InvestmentRequest" ADD CONSTRAINT "InvestmentRequest_targetInvestmentId_fkey" FOREIGN KEY ("targetInvestmentId") REFERENCES "Investment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
