'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { AuthError, requireStaff } from '@/lib/auth';
import { approveInvestmentRequest, rejectInvestmentRequest } from '@/lib/requests';
import { reviewInvestmentRequestSchema, rejectInvestmentRequestSchema } from '@/lib/validation';
import { ZodError } from 'zod';

export type ReviewState = { ok: false; fieldErrors: Record<string, string[]>; formError?: string } | { ok: true; investmentId?: string | null };

function flattenFieldErrors(error: ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : 'form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

async function getRequestMeta() {
  const h = await headers();
  const realIp = h.get('x-real-ip')?.trim() ?? null;
  const forwardedFor = h.get('x-forwarded-for');
  const forwardedIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() ?? null : null;
  const meta = { ipAddress: realIp ?? forwardedIp, userAgent: h.get('user-agent') };
  return meta;
}

export async function approveRequestAction(id: string, prev: ReviewState, formData: FormData): Promise<ReviewState> {
  let staff;
  try {
    staff = await requireStaff();
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, fieldErrors: {}, formError: 'Please sign in as staff to continue.' };
    throw error;
  }

  const raw: Record<string, unknown> = {};
  for (const key of ['shares', 'depositMethod', 'depositRef', 'depositDate', 'reviewNote']) {
    const val = formData.get(key);
    if (val === null) continue;
    raw[key] = val;
  }
  if (raw.shares !== undefined) raw.shares = Number(raw.shares);

  // isEntrepreneur: hidden companion input always submits "false"; checkbox submits "true" when checked.
  // FormData.get returns the FIRST value, so use getAll and take the LAST to respect the checkbox.
  const isEntrepreneurValues = formData.getAll('isEntrepreneur');
  if (isEntrepreneurValues.length > 0) {
    const lastVal = isEntrepreneurValues[isEntrepreneurValues.length - 1];
    raw.isEntrepreneur = lastVal === 'true';
  }

  const parsed = reviewInvestmentRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };

  const data = parsed.data;
  const depositDate = data.depositDate ? new Date(data.depositDate) : undefined;

  try {
    const result = await approveInvestmentRequest(
      {
        requestId: id,
        staffId: staff.id,
        shares: data.shares,
        isEntrepreneur: data.isEntrepreneur,
        depositMethod: data.depositMethod,
        depositRef: data.depositRef,
        depositDate: depositDate,
        reviewNote: data.reviewNote,
      },
      await getRequestMeta(),
    );

    revalidatePath('/admin/requests');
    revalidatePath(`/admin/requests/${id}`);
    revalidatePath('/admin');
    revalidatePath('/portal');
    if (result.investmentId) {
      revalidatePath(`/admin/receipts/${result.investmentId}`);
    }
    return { ok: true, investmentId: result.investmentId };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, fieldErrors: {}, formError: error.message };
    }
    throw error;
  }
}

export async function rejectRequestAction(id: string, prev: ReviewState, formData: FormData): Promise<ReviewState> {
  let staff;
  try {
    staff = await requireStaff();
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, fieldErrors: {}, formError: 'Please sign in as staff to continue.' };
    throw error;
  }

  const raw: Record<string, unknown> = {};
  for (const key of ['reviewNote']) {
    const val = formData.get(key);
    if (val === null) continue;
    raw[key] = val;
  }

  const parsed = rejectInvestmentRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };

  try {
    await rejectInvestmentRequest(
      {
        requestId: id,
        staffId: staff.id,
        reviewNote: parsed.data.reviewNote,
      },
      await getRequestMeta(),
    );

    revalidatePath('/admin/requests');
    revalidatePath(`/admin/requests/${id}`);
    revalidatePath('/admin');
    revalidatePath('/portal');
    return { ok: true, investmentId: null };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, fieldErrors: {}, formError: error.message };
    }
    throw error;
  }
}
