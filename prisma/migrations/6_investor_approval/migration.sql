-- Investor approval gate: self-registered accounts wait for staff approval
-- before the portal unlocks. Additive; existing auth-linked investors are
-- grandfathered as APPROVED so nobody currently using the portal is locked out.
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED');

ALTER TABLE "Investor" ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "Investor" SET "approvalStatus" = 'APPROVED' WHERE "authUserId" IS NOT NULL;
