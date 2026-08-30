'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { AuthError, requireInvestor } from '@/lib/auth';
import { submitInvestmentRequest, type SubmitInvestmentRequestInput } from '@/lib/requests';
import { submitInvestmentRequestSchema } from '@/lib/validation';
import { ZodError } from 'zod';

export type SubmitInvestmentRequestState =
  | { ok: false; fieldErrors: Record<string, string[]>; formError?: string }
  | { ok: true; requestId: string };

function flattenFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : 'form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export async function submitInvestmentRequestAction(
  prevState: SubmitInvestmentRequestState,
  formData: FormData,
): Promise<SubmitInvestmentRequestState> {
  let investor;
  try {
    investor = await requireInvestor();
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, fieldErrors: {}, formError: 'authRequired' };
    }
    throw error;
  }

  const raw = {
    shares: formData.get('shares'),
    entrepreneurRequested: formData.get('entrepreneurRequested') === 'on',
    depositMethod: formData.get('depositMethod'),
    depositRef: (() => { const v = String(formData.get('depositRef') ?? '').trim(); return v || undefined; })(),
    depositDate: formData.get('depositDate'),
    note: (() => { const v = String(formData.get('note') ?? '').trim(); return v || undefined; })(),
  };

  const parsed = submitInvestmentRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };

  const h = await headers();
  const realIp = h.get('x-real-ip')?.trim() ?? null;
  const forwardedFor = h.get('x-forwarded-for');
  const forwardedIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() ?? null : null;
  const requestMeta = { ipAddress: realIp ?? forwardedIp, userAgent: h.get('user-agent') };

  try {
    const input: SubmitInvestmentRequestInput = {
      investorId: investor.id,
      shares: parsed.data.shares,
      entrepreneurRequested: parsed.data.entrepreneurRequested,
      depositMethod: parsed.data.depositMethod,
      depositRef: parsed.data.depositRef,
      depositDate: parsed.data.depositDate,
      note: parsed.data.note,
    };
    const request = await submitInvestmentRequest(input, requestMeta);
    revalidatePath('/portal');
    return { ok: true, requestId: request.id };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('3 open requests')) {
        return { ok: false, fieldErrors: {}, formError: 'openRequestCap' };
      }
      if (error.message.includes('Entrepreneur')) {
        return { ok: false, fieldErrors: {}, formError: 'entrepreneurMinShares' };
      }
      if (error.message.includes('Shares must be between')) {
        return { ok: false, fieldErrors: {}, formError: 'sharesRange' };
      }
    }
    return { ok: false, fieldErrors: {}, formError: 'generic' };
  }
}
