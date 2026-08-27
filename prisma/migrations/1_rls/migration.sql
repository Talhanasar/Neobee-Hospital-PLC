/*
  Defense-in-depth Row-Level Security (RLS) for Supabase.
  The application-layer API must independently enforce authorization.
  This RLS policy layer is a secondary lock, not the primary one.
  It is expected to be REMOVED after the planned migration to self-hosted Postgres.
*/

-- The service-role key bypasses RLS entirely. Application-layer authorization must be correct.

-- Enable RLS on all tables
ALTER TABLE "Investor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Investment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Setting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstallmentSchedule" ENABLE ROW LEVEL SECURITY;

-- Staff may select broadly and insert into core financial tables.
-- Note: this deliberately checks the Staff table, not a JWT role claim.
-- The app does not set a custom role claim, so a policy referencing one would fail.
DROP POLICY IF EXISTS staff_access_policy ON "Investor";
CREATE POLICY staff_access_policy ON "Investor" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Staff" WHERE "authUserId" = (select auth.uid()::text) AND "isActive" = true));

DROP POLICY IF EXISTS staff_access_policy ON "Investment";
CREATE POLICY staff_access_policy ON "Investment" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Staff" WHERE "authUserId" = (select auth.uid()::text) AND "isActive" = true));

DROP POLICY IF EXISTS staff_insert_policy ON "Investment";
CREATE POLICY staff_insert_policy ON "Investment" FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM "Staff" WHERE "authUserId" = (select auth.uid()::text) AND "isActive" = true));

DROP POLICY IF EXISTS staff_access_policy ON "Transaction";
CREATE POLICY staff_access_policy ON "Transaction" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Staff" WHERE "authUserId" = (select auth.uid()::text) AND "isActive" = true));

DROP POLICY IF EXISTS staff_insert_policy ON "Transaction";
CREATE POLICY staff_insert_policy ON "Transaction" FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM "Staff" WHERE "authUserId" = (select auth.uid()::text) AND "isActive" = true));

DROP POLICY IF EXISTS staff_access_policy ON "AuditLog";
CREATE POLICY staff_access_policy ON "AuditLog" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Staff" WHERE "authUserId" = (select auth.uid()::text) AND "isActive" = true));

DROP POLICY IF EXISTS staff_access_policy ON "InstallmentSchedule";
CREATE POLICY staff_access_policy ON "InstallmentSchedule" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Staff" WHERE "authUserId" = (select auth.uid()::text) AND "isActive" = true));

-- Settings are readable by staff. Writes must go through audited API endpoints.
DROP POLICY IF EXISTS staff_access_policy ON "Setting";
CREATE POLICY staff_access_policy ON "Setting" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Staff" WHERE "authUserId" = (select auth.uid()::text) AND "isActive" = true));

-- An authenticated investor may select their own records.
-- authUserId is TEXT, so auth.uid() must be cast.
DROP POLICY IF EXISTS investor_access_own_row ON "Investor";
CREATE POLICY investor_access_own_row ON "Investor" FOR SELECT
  USING ("authUserId" = (select auth.uid()::text));

-- An investor may select investments linked to their investor row.
DROP POLICY IF EXISTS investor_access_own_investments ON "Investment";
CREATE POLICY investor_access_own_investments ON "Investment" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Investor" WHERE "id" = "Investment"."investorId" AND "authUserId" = (select auth.uid()::text)));

-- An investor may select transactions linked to their investments.
DROP POLICY IF EXISTS investor_access_own_transactions ON "Transaction";
CREATE POLICY investor_access_own_transactions ON "Transaction" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Investment" WHERE "id" = "Transaction"."investmentId" AND EXISTS (SELECT 1 FROM "Investor" WHERE "id" = "Investment"."investorId" AND "authUserId" = (select auth.uid()::text))));

-- Financial records are immutable. No client-side DELETE policy exists for Investment or Transaction.
-- With RLS enabled, this denies deletes by default.

-- Ledger rows are immutable. No client-side UPDATE policy exists for Transaction.
-- Corrections are new rows pointing to the old one.

-- The audit trail is append-only from the server. No client-side INSERT/UPDATE/DELETE.
