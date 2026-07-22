-- AlterTable
ALTER TABLE "Stakeholder" ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Stakeholder_verifiedAt_idx" ON "Stakeholder"("verifiedAt");
