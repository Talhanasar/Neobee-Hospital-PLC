-- Align InstallmentSchedule with the Prisma schema: a kisti agreement
-- cannot have two rows with the same installmentNo, and the per-investment
-- group index the interim payment-groups migration created is not part of
-- the schema.
CREATE UNIQUE INDEX IF NOT EXISTS "InstallmentSchedule_paymentGroupId_installmentNo_key" ON "InstallmentSchedule"("paymentGroupId", "installmentNo");

DROP INDEX IF EXISTS "Investment_paymentGroupId_idx";
