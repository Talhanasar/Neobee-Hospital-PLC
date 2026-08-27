-- CreateEnum
CREATE TYPE "InvestmentRequestStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "InvestmentRequest" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "entrepreneurRequested" BOOLEAN NOT NULL DEFAULT false,
    "sharePrice" INTEGER NOT NULL,
    "incentivePerShare" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "depositMethod" "DepositMethod" NOT NULL,
    "depositRef" TEXT,
    "depositDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "InvestmentRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedByStaffId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "investmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentRequest_investmentId_key" ON "InvestmentRequest"("investmentId");

-- CreateIndex
CREATE INDEX "InvestmentRequest_investorId_idx" ON "InvestmentRequest"("investorId");

-- CreateIndex
CREATE INDEX "InvestmentRequest_status_createdAt_idx" ON "InvestmentRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "InvestmentRequest" ADD CONSTRAINT "InvestmentRequest_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentRequest" ADD CONSTRAINT "InvestmentRequest_reviewedByStaffId_fkey" FOREIGN KEY ("reviewedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentRequest" ADD CONSTRAINT "InvestmentRequest_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable RLS on InvestmentRequest
ALTER TABLE "InvestmentRequest" ENABLE ROW LEVEL SECURITY;

-- Staff may select all investment requests for review.
DROP POLICY IF EXISTS staff_access_policy ON "InvestmentRequest";
CREATE POLICY staff_access_policy ON "InvestmentRequest" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Staff" WHERE "authUserId" = (select auth.uid()::text) AND "isActive" = true));

-- An authenticated investor may select their own investment requests.
DROP POLICY IF EXISTS investor_access_own_requests ON "InvestmentRequest";
CREATE POLICY investor_access_own_requests ON "InvestmentRequest" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Investor" WHERE "id" = "InvestmentRequest"."investorId" AND "authUserId" = (select auth.uid()::text)));