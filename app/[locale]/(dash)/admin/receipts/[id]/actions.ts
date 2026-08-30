'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { AuthError, requireStaff } from '@/lib/auth';
import { recordInvestmentPayment } from '@/lib/requests';
import { z } from 'zod';
import { demoRecordPayment, isDemoData } from '@/data/demo/store';

const recordPaymentSchema = z
  .object({
    amount: z.coerce.number().int().min(1),
    depositMethod: z.enum(['BANK_DEPOSIT', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING']),
    depositRef: z.string().trim().max(100).transform((v) => (v === '' ? null : v)).nullish(),
    depositDate: z.coerce.date(),
    note: z.string().trim().max(2000).transform((v) => (v === '' ? null : v)).nullish(),
  })
  .strict();

export type RecordPaymentState =
  | { ok: false; fieldErrors: Record<string, string[]>; formError?: string }
  | { ok: true; transactionId: string };

export async function recordPaymentAction(
  investmentId: string,
  prev: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  let staff;
  try {
    staff = await requireStaff();
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, fieldErrors: {}, formError: 'Please sign in as staff to continue.' };
    throw error;
  }

  const parsed = recordPaymentSchema.safeParse({
    amount: formData.get('amount'),
    depositMethod: formData.get('depositMethod'),
    depositRef: formData.get('depositRef') ?? undefined,
    depositDate: formData.get('depositDate'),
    note: formData.get('note') ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] ? String(issue.path[0]) : 'form';
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, fieldErrors };
  }

  const h = await headers();
  const realIp = h.get('x-real-ip')?.trim() ?? null;
  const forwardedFor = h.get('x-forwarded-for');
  const forwardedIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() ?? null : null;

  if (isDemoData()) {
    const transactionId = demoRecordPayment(investmentId, {
      amount: parsed.data.amount,
      depositMethod: parsed.data.depositMethod,
      depositRef: parsed.data.depositRef,
      depositDate: parsed.data.depositDate,
      note: parsed.data.note,
    });
    revalidatePath(`/admin/receipts/${investmentId}`);
    return { ok: true, transactionId };
  }

  try {
    const transactionId = await recordInvestmentPayment(
      {
        investmentId,
        staffId: staff.id,
        amount: parsed.data.amount,
        depositMethod: parsed.data.depositMethod,
        depositRef: parsed.data.depositRef,
        depositDate: parsed.data.depositDate,
        note: parsed.data.note,
      },
      { ipAddress: realIp ?? forwardedIp, userAgent: h.get('user-agent') },
    );
    revalidatePath(`/admin/receipts/${investmentId}`);
    revalidatePath('/admin');
    return { ok: true, transactionId };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, fieldErrors: {}, formError: error.message };
    }
    throw error;
  }
}
