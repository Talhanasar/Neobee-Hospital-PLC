'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { storage, extensionForContentType } from '@/lib/storage';
import { getCurrentUser, signUpInvestor, sendVerificationOtp, verifyEmailOtp, signIn } from '@/lib/auth-own';
import { sendOtpEmail } from '@/lib/auth-own/mailer';
import { investorSignupSchema, validateSlipFile } from '@/lib/validation';
import { submitInvestmentRequest } from '@/lib/requests';
import { writeAuditLog, actionVerbs, getRequestMetadataFromHeaders } from '@/lib/audit';
import { ActorType } from '@/lib/generated/prisma/client';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { isDemoData } from '@/data/demo/store';

export type InvestorSignupState =
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

export async function sendRegistrationOtpAction(
  email: string,
  password?: string,
): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: false, error: 'invalidEmail' };

  if (password) {
    const signupRes = await signUpInvestor(normalized, password);
    if (!signupRes.ok) {
      if (signupRes.error === 'emailTaken') {
        const otpRes = await sendVerificationOtp(normalized);
        const mailRes = await sendOtpEmail(normalized, otpRes.code, 'EMAIL_VERIFY');
        if (!mailRes.ok) {
          console.error('[register] OTP mail failed:', mailRes.error);
          return { ok: false, error: 'otpSendFailed' };
        }
        return { ok: true };
      }
      return { ok: false, error: signupRes.error };
    }
    const mailRes = await sendOtpEmail(normalized, signupRes.code, 'EMAIL_VERIFY');
    if (!mailRes.ok) {
      console.error('[register] OTP mail failed:', mailRes.error);
      return { ok: false, error: 'otpSendFailed' };
    }
    return { ok: true };
  }

  const otpRes = await sendVerificationOtp(normalized);
  const mailRes = await sendOtpEmail(normalized, otpRes.code, 'EMAIL_VERIFY');
  if (!mailRes.ok) {
    console.error('[register] OTP mail failed:', mailRes.error);
    return { ok: false, error: 'otpSendFailed' };
  }
  return { ok: true };
}

export async function verifyRegistrationOtpAction(
  email: string,
  code: string,
  password?: string,
): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.trim().toLowerCase();
  const verifyRes = await verifyEmailOtp(normalized, code.trim());
  if (!verifyRes.ok) {
    return { ok: false, error: 'invalidOrExpiredOtp' };
  }
  if (password) {
    await signIn(normalized, password);
  }
  return { ok: true };
}

/**
 * Final step of the registration wizard. The email OTP has already been
 * verified (own-auth session exists); this action persists
 * everything in one pass: link the Investor row to the auth user, upload
 * the deposit slip, and file the SHARE_PURCHASE request for staff review.
 * No money is recorded — approval is the staff's job (WP3 flow).
 */
export async function investorSignupAction(
  _prevState: InvestorSignupState,
  formData: FormData,
): Promise<InvestorSignupState> {
  // Demo mode: no database session — validate + persist against the in-memory store.
  if (isDemoData()) {
    const parsed = investorSignupSchema.safeParse({
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: String(formData.get('email') ?? '').trim(),
      address: String(formData.get('address') ?? '').trim() || undefined,
      nationalIdNumber: formData.get('nationalIdNumber'),
      password: formData.get('password'),
      shares: formData.get('shares'),
      paymentPlan: formData.get('paymentPlan'),
      depositMethod: formData.get('depositMethod'),
      depositRef: String(formData.get('depositRef') ?? '').trim() || undefined,
      depositDate: formData.get('depositDate'),
      note: String(formData.get('note') ?? '').trim() || undefined,
    });
    if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };
    const { demoSignUp, demoCreateRequest } = await import('@/data/demo/store');
    const result = demoSignUp({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      password: parsed.data.password,
      nationalIdNumber: parsed.data.nationalIdNumber,
    });
    if (!result.ok) return { ok: false, fieldErrors: {}, formError: result.error === 'duplicateEmail' ? 'duplicateEmail' : 'duplicatePhone' };
    const requestId = demoCreateRequest({
      investorId: result.investorId,
      kind: 'SHARE_PURCHASE',
      shares: parsed.data.shares,
      entrepreneurRequested: false,
      paymentPlan: parsed.data.paymentPlan,
      depositMethod: parsed.data.depositMethod,
      depositRef: parsed.data.depositRef ?? null,
      depositDate: parsed.data.depositDate,
      note: parsed.data.note ?? null,
    });
    revalidatePath('/admin/registrations');
    revalidatePath('/admin');
    revalidatePath('/admin/requests');
    return { ok: true, requestId };
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { ok: false, fieldErrors: {}, formError: 'unauthenticated' };
  }
  const authUserId = currentUser.id;
  const sessionEmail = currentUser.email?.trim().toLowerCase() ?? '';

  const parsed = investorSignupSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: String(formData.get('email') ?? '').trim() || sessionEmail,
    address: String(formData.get('address') ?? '').trim() || undefined,
    nationalIdNumber: formData.get('nationalIdNumber'),
    password: formData.get('password'),
    shares: formData.get('shares'),
    paymentPlan: formData.get('paymentPlan'),
    depositMethod: formData.get('depositMethod'),
    depositRef: String(formData.get('depositRef') ?? '').trim() || undefined,
    depositDate: formData.get('depositDate'),
    note: String(formData.get('note') ?? '').trim() || undefined,
  });
  if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };
  const input = parsed.data;

  const slip = formData.get('slipFile');
  let slipFileKey: string | null = null;
  if (!(slip instanceof File) || slip.size === 0) {
    return { ok: false, fieldErrors: { slipFile: ['Deposit slip image is required'] } };
  }
  const slipError = validateSlipFile(slip);
  if (slipError) return { ok: false, fieldErrors: { slipFile: [slipError] } };

  const requestMeta = await getRequestMetadataFromHeaders();

  try {
    // 1. Upload the slip first — the request row references its key.
    slipFileKey = `slips/${randomUUID()}${extensionForContentType(slip.type)}`;
    const body = new Uint8Array(await slip.arrayBuffer());
    await storage.uploadFile(slipFileKey, body, slip.type);

    // 2. Investor row (link by auth user; phone conflicts bounce to the caller).
    const investor = await prisma.investor.upsert({
      where: { authUserId },
      create: {
        authUserId,
        phone: input.phone,
        name: input.name,
        email: input.email,
        nationalIdNumber: input.nationalIdNumber,
        address: input.address ?? null,
        // Self-registered investors start PENDING; staff approval opens the portal.
      },
      update: {
        phone: input.phone,
        name: input.name,
        email: input.email,
        nationalIdNumber: input.nationalIdNumber,
        address: input.address ?? null,
      },
    });

    // 3. File the share-purchase request (amount computed server-side from settings).
    const request = await submitInvestmentRequest(
      {
        investorId: investor.id,
        shares: input.shares,
        entrepreneurRequested: false,
        paymentPlan: input.paymentPlan,
        slipFileKey,
        depositMethod: input.depositMethod,
        depositRef: input.depositRef,
        depositDate: input.depositDate,
        note: input.note,
      },
      requestMeta,
    );

    await writeAuditLog({
      actorType: ActorType.INVESTOR,
      actorId: investor.id,
      action: actionVerbs.investorRegister,
      targetType: 'Investor',
      targetId: investor.id,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      metadata: { name: input.name, phone: input.phone, email: input.email },
    });

    revalidatePath('/portal');
    revalidatePath('/admin/requests');
    return { ok: true, requestId: request.id };
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      const target = (error as { meta?: { target?: unknown[] } }).meta?.target;
      if (Array.isArray(target) && target.includes('phone')) {
        return { ok: false, fieldErrors: {}, formError: 'phoneTaken' };
      }
    }
    return { ok: false, fieldErrors: {}, formError: 'generic' };
  }
}
