-- The refSequence unique constraint was table-wide, but NHL-K and NHL-PG
-- series count independently (each starts at 1). Uniqueness must be per kind.
DROP INDEX "PaymentGroup_refSequence_key";
CREATE UNIQUE INDEX "PaymentGroup_kind_refSequence_key" ON "PaymentGroup"("kind", "refSequence");
