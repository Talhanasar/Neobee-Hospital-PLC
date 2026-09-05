import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import type { Prisma } from '@/lib/generated/prisma/client';

export type SharePlan = 'FULL' | 'INSTALLMENT';

export class SharePoolExhaustedError extends Error {
  constructor(
    readonly plan: SharePlan,
    readonly requested: number,
    readonly remaining: number,
  ) {
    super(`Share pool exhausted for plan ${plan}: requested ${requested}, remaining ${remaining}`);
    this.name = 'SharePoolExhaustedError';
  }
}

// Committed shares = PENDING + CONFIRMED investments of the plan, plus
// SUBMITTED share-purchase requests of the same plan (they can still be
// approved, so they hold their pool reservation).
export async function remainingPoolShares(
  plan: SharePlan,
  client: Prisma.TransactionClient,
  options: { excludeRequestId?: string } = {},
): Promise<number> {
  const settings = await getSettings();
  const limit = plan === 'FULL' ? settings.FULL_PAYMENT_SHARE_LIMIT : settings.INSTALLMENT_SHARE_LIMIT;
  const [invAgg, reqAgg] = await Promise.all([
    client.investment.aggregate({
      where: { paymentPlan: plan, status: { in: ['PENDING', 'CONFIRMED'] } },
      _sum: { shares: true },
    }),
    client.investmentRequest.aggregate({
      where: {
        kind: 'SHARE_PURCHASE',
        paymentPlan: plan,
        status: 'SUBMITTED',
        ...(options.excludeRequestId ? { id: { not: options.excludeRequestId } } : {}),
      },
      _sum: { shares: true },
    }),
  ]);
  const committed = (invAgg._sum.shares ?? 0) + (reqAgg._sum.shares ?? 0);
  return limit - committed;
}

export async function assertSharePoolAllows(
  plan: SharePlan,
  requestedShares: number,
  client: Prisma.TransactionClient = prisma,
  options: { excludeRequestId?: string } = {},
): Promise<void> {
  const remaining = await remainingPoolShares(plan, client, options);
  if (requestedShares > remaining) {
    throw new SharePoolExhaustedError(plan, requestedShares, Math.max(remaining, 0));
  }
}
