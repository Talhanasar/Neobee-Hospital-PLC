'use server';

import { revalidatePath } from 'next/cache';
import { AuthError, assertOwnsInvestment, requireInvestor } from '@/lib/auth';
import { confirmInvestment } from '@/lib/investments';

export type ConfirmState = { ok: boolean; error?: string };

export async function confirmInvestmentAction(investmentId: string): Promise<ConfirmState> {
  try {
    const investor = await requireInvestor();
    await assertOwnsInvestment(investor.id, investmentId);
    await confirmInvestment(investmentId, investor.id, { ipAddress: null, userAgent: null });
    revalidatePath('/portal');
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    throw error;
  }
}
