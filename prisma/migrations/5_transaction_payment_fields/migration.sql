-- Payment provenance on ledger rows: how and when the money actually
-- arrived. Optional columns — corrections may not carry them.

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "depositMethod" "DepositMethod",
ADD COLUMN     "depositDate" TIMESTAMP(3);
