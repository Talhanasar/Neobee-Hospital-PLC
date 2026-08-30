-- Public interest / lead-capture submissions ("Become a Shareholder").
-- Leads are marketing contacts, not financial records: soft-warned
-- duplicates by phone, never deleted, progressed to CONTACTED by staff.

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "contactedAt" TIMESTAMP(3),
    "contactedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_ref_key" ON "Lead"("ref");
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactedByStaffId_fkey" FOREIGN KEY ("contactedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defense-in-depth RLS (secondary lock — the application layer enforces
-- authorization; writes happen exclusively through the audited server
-- actions, so there is deliberately no anon INSERT policy).
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_access_policy ON "Lead";
CREATE POLICY staff_access_policy ON "Lead" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Staff" WHERE "authUserId" = (select auth.uid()::text) AND "isActive" = true));
