'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { AuthError, requireInvestor } from '@/lib/auth';
import {
  submitInvestmentRequest,
  submitPaymentRequest,
  type SubmitInvestmentRequestInput,
} from '@/lib/requests';
import { storage } from '@/lib/storage';
import { submitInvestmentRequestSchema, submitPaymentRequestSchema, validateSlipFile } from '@/lib/validation';
import { demoCreateRequest, isDemoData } from '@/data/demo/store';
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
  if (investor.approvalStatus === 'PENDING') {
    return { ok: false, fieldErrors: {}, formError: 'pendingApproval' };
  }

  const h = await headers();
  const realIp = h.get('x-real-ip')?.trim() ?? null;
  const forwardedFor = h.get('x-forwarded-for');
  const forwardedIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() ?? null : null;
  const requestMeta = { ipAddress: realIp ?? forwardedIp, userAgent: h.get('user-agent') };

  const common = {
    depositMethod: formData.get('depositMethod'),
    depositRef: (() => { const v = String(formData.get('depositRef') ?? '').trim(); return v || undefined; })(),
    depositDate: formData.get('depositDate'),
    note: (() => { const v = String(formData.get('note') ?? '').trim(); return v || undefined; })(),
  };

  try {
    if (formData.get('kind') === 'PAYMENT') {
      const parsed = submitPaymentRequestSchema.safeParse({
        targetInvestmentId: formData.get('targetInvestmentId'),
        amount: formData.get('amount'),
        installmentNo: formData.get('installmentNo') || undefined,
        ...common,
      });
      if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };

      if (isDemoData()) {
        const demoResult = demoCreateRequest({
          investorId: investor.id,
          kind: 'PAYMENT',
          targetInvestmentId: parsed.data.targetInvestmentId,
          amount: parsed.data.amount,
          depositMethod: parsed.data.depositMethod,
          depositRef: parsed.data.depositRef,
          depositDate: parsed.data.depositDate,
          note: parsed.data.note,
        });
        if (demoResult === 'cap') return { ok: false, fieldErrors: {}, formError: 'openRequestCap' };
        if (demoResult === 'target') return { ok: false, fieldErrors: {}, formError: 'targetInvestment' };
        if (demoResult === 'kistiClaimed') return { ok: false, fieldErrors: {}, formError: 'kistiAlreadyClaimed' };
        revalidatePath('/portal');
        revalidatePath('/portal/invest');
        revalidatePath('/admin/requests');
        return { ok: true, requestId: demoResult };
      }

      // Deposit slip upload (optional on kisti payments but verified when present).
      let slipFileKey: string | null = null;
      const slip = formData.get('slipFile');
      if (slip instanceof File && slip.size > 0) {
        const slipError = validateSlipFile(slip);
        if (slipError) return { ok: false, fieldErrors: { slipFile: [slipError] } };
        slipFileKey = `slips/${randomUUID()}`;
        await storage.uploadFile(slipFileKey, new Uint8Array(await slip.arrayBuffer()), slip.type);
      }

      const request = await submitPaymentRequest(
        {
          investorId: investor.id,
          targetInvestmentId: parsed.data.targetInvestmentId,
          amount: parsed.data.amount,
          installmentNo: parsed.data.installmentNo ?? null,
          slipFileKey,
          depositMethod: parsed.data.depositMethod,
          depositRef: parsed.data.depositRef,
          depositDate: parsed.data.depositDate,
          note: parsed.data.note,
        },
        requestMeta,
      );
      revalidatePath('/portal');
      revalidatePath('/portal/invest');
      revalidatePath('/admin/requests');
      return { ok: true, requestId: request.id };
    }

    const parsed = submitInvestmentRequestSchema.safeParse({
      shares: formData.get('shares'),
      entrepreneurRequested: formData.get('entrepreneurRequested') === 'on',
      ...common,
    });
    if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };

    if (isDemoData()) {
      const demoResult = demoCreateRequest({
        investorId: investor.id,
        kind: 'SHARE_PURCHASE',
        shares: parsed.data.shares,
        entrepreneurRequested: parsed.data.entrepreneurRequested,
        depositMethod: parsed.data.depositMethod,
        depositRef: parsed.data.depositRef,
        depositDate: parsed.data.depositDate,
        note: parsed.data.note,
      });
      if (demoResult === 'cap') return { ok: false, fieldErrors: {}, formError: 'openRequestCap' };
      if (demoResult === 'entrepreneurMin') return { ok: false, fieldErrors: {}, formError: 'entrepreneurMinShares' };
      revalidatePath('/portal');
      revalidatePath('/admin/requests');
      return { ok: true, requestId: demoResult };
    }

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
    revalidatePath('/admin/requests');
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
      if (error.message.includes('Target investment')) {
        return { ok: false, fieldErrors: {}, formError: 'targetInvestment' };
      }
      if (error.message.includes('Amount must be')) {
        return { ok: false, fieldErrors: {}, formError: 'amountInvalid' };
      }
    }
    return { ok: false, fieldErrors: {}, formError: 'generic' };
  }
}
