import 'server-only';
import { Prisma } from '@/lib/generated/prisma/client';
import { formatGroupRef, type GroupSeries } from '@/lib/money';

export type PaymentGroupKind = 'INSTANT' | 'KISTI';

// Reference series per group kind: KISTI agreements are NHL-K-…, instant
// combined payments are NHL-PG-…. Counters are separate DB sequences, so a
// share sale never advances a kisti or payment-group number.
const SERIES_BY_KIND: Record<PaymentGroupKind, { sequence: string; series: GroupSeries }> = {
  KISTI: { sequence: 'kisti_uid_seq', series: 'K' },
  INSTANT: { sequence: 'payment_group_uid_seq', series: 'PG' },
};

export interface CreatePaymentGroupParams {
  investorId: string;
  kind: PaymentGroupKind;
  shareCount: number;
  totalAmount: number;
  slipFileKey?: string | null;
}

// Must run inside the caller's transaction so the ref sequence, the group row
// and the investments it wraps commit atomically.
export async function createPaymentGroup(
  tx: Prisma.TransactionClient,
  params: CreatePaymentGroupParams,
): Promise<Prisma.PaymentGroupGetPayload<object>> {
  const config = SERIES_BY_KIND[params.kind];
  // Sequence identifiers cannot be parameterized — branch on the fixed, code-owned names.
  const rows = config.sequence === 'kisti_uid_seq'
    ? await tx.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('kisti_uid_seq') AS nextval`
    : await tx.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('payment_group_uid_seq') AS nextval`;
  const sequence = Number(rows[0]?.nextval ?? BigInt(0));
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new RangeError(`${config.sequence} returned an unsafe value`);
  }

  return tx.paymentGroup.create({
    data: {
      investorId: params.investorId,
      kind: params.kind,
      ref: formatGroupRef(config.series, sequence),
      refSequence: sequence,
      shareCount: params.shareCount,
      totalAmount: params.totalAmount,
      slipFileKey: params.slipFileKey ?? null,
    },
  });
}

// Combines a legacy-style per-share kisti display id with the owning group:
// group kistis render as `<NHL-K-ref>-K<n>` so every kisti carries a unique,
// traceable identifier while remaining visually tied to its agreement.
export function groupKistiRef(groupRef: string, installmentNo: number): string {
  if (installmentNo < 1 || !Number.isInteger(installmentNo)) {
    throw new RangeError('installmentNo must be a positive integer');
  }
  return `${groupRef}-K${installmentNo}`;
}
