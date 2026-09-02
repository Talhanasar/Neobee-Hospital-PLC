/*
  Payment plans (FULL vs INSTALLMENT), the 4th tier (GOLDEN_DIRECTOR),
  deposit-slip upload keys, per-kisti numbering, and certificates for
  fully-paid investments. Additive only — no drops, no column removals.
*/

-- CreateEnum
CREATE TYPE "PaymentPlan" AS ENUM ('FULL', 'INSTALLMENT');

-- AlterEnum
ALTER TYPE "InvestmentCategory" ADD VALUE 'GOLDEN_DIRECTOR';

-- AlterTable
ALTER TABLE "Investor" ADD COLUMN "address" TEXT;

-- AlterTable
ALTER TABLE "Investment" ADD COLUMN "discountPerShare" INTEGER NOT NULL DEFAULT 0,
                       ADD COLUMN "paymentPlan" "PaymentPlan" NOT NULL DEFAULT 'FULL',
                       ADD COLUMN "slipFileKey" TEXT,
                       ADD COLUMN "fullyPaidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InvestmentRequest" ADD COLUMN "paymentPlan" "PaymentPlan",
                                ADD COLUMN "installmentNo" INTEGER,
                                ADD COLUMN "slipFileKey" TEXT;

-- AlterTable
ALTER TABLE "InstallmentSchedule" ADD COLUMN "installmentNo" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_investmentId_key" ON "Certificate"("investmentId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentSchedule_investmentId_installmentNo_key" ON "InstallmentSchedule"("investmentId", "installmentNo");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New runtime settings (mirrors DEFAULT_SETTINGS in lib/money.ts).
INSERT INTO "Setting" ("key", "value", "createdAt", "updatedAt") VALUES
  ('FULL_PAYMENT_DISCOUNT_PER_SHARE', 10000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('INSTALLMENT_UNIT_AMOUNT', 50000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('INSTALLMENT_COUNT', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP;

-- Re-point target to the 180 crore programme figure and retire the per-share entrepreneur incentive.
INSERT INTO "Setting" ("key", "value", "createdAt", "updatedAt") VALUES
  ('TARGET_AMOUNT', 1800000000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('INCENTIVE_PER_SHARE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP;

/*
  RLS for Certificate, mirroring the 1_rls pattern:
  staff read all; investors read their own; writes only via service role.
*/
ALTER TABLE "Certificate" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_access_policy ON "Certificate";
CREATE POLICY staff_access_policy ON "Certificate" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Staff" WHERE "authUserId" = (select auth.uid()::text) AND "isActive" = true));

DROP POLICY IF EXISTS investor_access_own_certificates ON "Certificate";
CREATE POLICY investor_access_own_certificates ON "Certificate" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Investment" WHERE "id" = "Certificate"."investmentId" AND EXISTS (SELECT 1 FROM "Investor" WHERE "id" = "Investment"."investorId" AND "authUserId" = (select auth.uid()::text))));
