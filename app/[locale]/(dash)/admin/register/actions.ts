'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { AuthError, requireStaff } from '@/lib/auth';
import { registerInvestment } from '@/lib/investments';
import { SharePoolExhaustedError } from '@/lib/share-pools';
import { registerInvestmentSchema, validateSlipFile } from '@/lib/validation';
import { storage, extensionForContentType } from '@/lib/storage';
import { ZodError } from 'zod';
import { demoCreateInvestorAccount, demoRegisterInvestment, isDemoData } from '@/data/demo/store';
import { createAuthUser } from '@/lib/auth-own/store';
import { prisma } from '@/lib/db';
import { writeAuditLog, actionVerbs } from '@/lib/audit';
import { ActorType } from '@/lib/generated/prisma/client';

export type RegisterState = { ok: false; fieldErrors: Record<string, string[]>; formError?: string } | { ok: true; uid: string; code: string; id?: string; accountCreated?: boolean };

function flattenFieldErrors(error: ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : 'form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export async function registerInvestmentAction(prev: RegisterState, formData: FormData): Promise<RegisterState> {
  let staff;
  try { staff = await requireStaff(); } catch (error) { if (error instanceof AuthError) return { ok: false, fieldErrors: {}, formError: 'Please sign in as staff to continue.' }; throw error; }
  const raw = {
    name: formData.get('name'),
    phone: formData.get('phone'),
    shares: Number(formData.get('shares')),
    isEntrepreneur: formData.get('isEntrepreneur') === 'on',
    depositMethod: formData.get('depositMethod'),
    depositDate: formData.get('depositDate'),
    email: (() => { const v = String(formData.get('email') ?? '').trim(); return v ? v : undefined; })(),
    accountPassword: (() => { const raw = String(formData.get('accountPassword') ?? ''); const v = raw.trim(); return v ? raw : undefined; })(),
    nationalIdNumber: (() => { const v = String(formData.get('nationalIdNumber') ?? '').trim(); return v ? v : undefined; })(),
    depositRef: (() => { const v = String(formData.get('depositRef') ?? '').trim(); return v ? v : undefined; })(),
    notes: (() => { const v = String(formData.get('notes') ?? '').trim(); return v ? v : undefined; })(),
  };
  const parsed = registerInvestmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };

  // Optional deposit-receipt image (staff scanned the slip the investor paid with).
  // Skipped in DEMO_DATA mode — the in-memory demo store has no file concept.
  const slip = formData.get('slipFile');
  let slipFileKey: string | null = null;
  if (!isDemoData() && slip instanceof File && slip.size > 0) {
    const slipError = validateSlipFile(slip);
    if (slipError) return { ok: false, fieldErrors: { slipFile: [slipError] } };
    try {
      slipFileKey = `slips/${randomUUID()}${extensionForContentType(slip.type)}`;
      await storage.uploadFile(slipFileKey, new Uint8Array(await slip.arrayBuffer()), slip.type);
    } catch {
      return { ok: false, fieldErrors: { slipFile: ['Could not upload the receipt image. Please try again.'] } };
    }
  }

  const h = await headers();
  const realIp = h.get('x-real-ip')?.trim() ?? null;
  const forwardedFor = h.get('x-forwarded-for');
  const forwardedIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() ?? null : null;
  const meta = { ipAddress: realIp ?? forwardedIp, userAgent: h.get('user-agent') };
  if (isDemoData()) {
    const created = demoRegisterInvestment(parsed.data);
    let accountCreated = false;
    if (parsed.data.accountPassword && parsed.data.email) {
      const account = demoCreateInvestorAccount(created.id, parsed.data.email, parsed.data.accountPassword);
      if (!account.ok) {
        return { ok: false, fieldErrors: { email: ['This email is already used by another account'] }, formError: undefined };
      }
      accountCreated = true;
    }
    revalidatePath('/admin');
    revalidatePath('/admin/register');
    return { ok: true, uid: created.uid, code: created.code, id: created.id, accountCreated };
  }
  try {
    const created = await registerInvestment(parsed.data, staff.id, meta, slipFileKey);
    let accountCreated = false;
    if (parsed.data.accountPassword && parsed.data.email) {
      try {
        const email = parsed.data.email;
        const password = parsed.data.accountPassword;
        const result = await createAuthUser(email, password, 'INVESTOR');
        if (!result.ok) {
          if (result.error === 'emailTaken') {
            return { ok: false, fieldErrors: { email: ['An account with this email already exists'] } };
          }
          throw new Error('Failed to create account');
        }
        const authUser = result.user;
        await prisma.investor.update({ where: { id: created.investorId }, data: { authUserId: authUser.id } });
        await writeAuditLog({
          actorType: ActorType.STAFF,
          actorId: staff.id,
          action: actionVerbs.investorLink,
          targetType: 'Investor',
          targetId: created.investorId,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
        accountCreated = true;
      } catch {
        return { ok: false, fieldErrors: {}, formError: 'Could not create the login account. The investment was registered — retry creating the account.' };
      }
    }
    revalidatePath('/admin');
    return { ok: true, uid: created.uid, code: created.code, id: created.id, accountCreated };
  } catch (error) {
    if (error instanceof SharePoolExhaustedError) {
      return { ok: false, fieldErrors: {}, formError: error.plan === 'FULL' ? 'The instant-payment share pool for this phase is fully allocated.' : 'The kisti share pool for this phase is fully allocated.' };
    }
    if (error instanceof RangeError) return { ok: false, fieldErrors: { shares: [error.message] } };
    throw error;
  }
}
