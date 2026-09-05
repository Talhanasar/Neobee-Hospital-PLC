'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { AuthError, assertOwnsInvestment, requireInvestor } from '@/lib/auth';
import { confirmInvestment } from '@/lib/investments';
import { prisma } from '@/lib/db';
import { createInvestorProfileSchema } from '@/lib/validation';
import { actionVerbs, writeAuditLog } from '@/lib/audit';
import { ActorType } from '@/lib/generated/prisma/client';
import { ZodError } from 'zod';
import { demoConfirmInvestment, demoUpdateInvestorProfile, isDemoData } from '@/data/demo/store';

export type ConfirmState = { ok: boolean; error?: string };

export async function confirmInvestmentAction(investmentId: string): Promise<ConfirmState> {
  try {
    const investor = await requireInvestor();
    if (investor.approvalStatus === 'PENDING') return { ok: false, error: 'pendingApproval' };
    await assertOwnsInvestment(investor.id, investmentId);
    if (isDemoData()) {
      demoConfirmInvestment(investmentId);
    } else {
      await confirmInvestment(investmentId, investor.id, { ipAddress: null, userAgent: null });
    }
    revalidatePath('/portal');
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    throw error;
  }
}

export type UpdateAccountState =
  | { ok: false; fieldErrors: Record<string, string[]>; formError?: string }
  | { ok: true };

function flattenFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : 'form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

// Account details: name / NID / phone / TIN / address are editable. Email is the
// verified own-auth identity (email verification, password reset) and is never
// editable here. Phone uniqueness is enforced against the @unique constraint.
export async function updateInvestorProfileAction(
  prevState: UpdateAccountState,
  formData: FormData,
): Promise<UpdateAccountState> {
  let investor;
  try {
    investor = await requireInvestor();
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, fieldErrors: {}, formError: 'authRequired' };
    throw error;
  }
  if (investor.approvalStatus === 'PENDING') return { ok: false, fieldErrors: {}, formError: 'pendingApproval' };

  const parsed = createInvestorProfileSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    nationalIdNumber: formData.get('nationalIdNumber'),
    address: (() => { const v = String(formData.get('address') ?? '').trim(); return v ? v : undefined; })(),
    tin: (() => { const v = String(formData.get('tin') ?? '').trim(); return v ? v : undefined; })(),
  });
  if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };

  const h = await headers();
  const realIp = h.get('x-real-ip')?.trim() ?? null;
  const forwardedFor = h.get('x-forwarded-for');
  const forwardedIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() ?? null : null;

  if (isDemoData()) {
    const ok = demoUpdateInvestorProfile(investor.id, {
      name: parsed.data.name,
      phone: parsed.data.phone,
      nationalIdNumber: parsed.data.nationalIdNumber ?? null,
      address: parsed.data.address ?? null,
      tin: parsed.data.tin ?? null,
    });
    if (!ok) return { ok: false, fieldErrors: {}, formError: 'phoneTaken' };
    revalidatePath('/portal/account');
    revalidatePath('/portal');
    return { ok: true };
  }

  const existing = await prisma.investor.findUnique({ where: { phone: parsed.data.phone }, select: { id: true } });
  if (existing && existing.id !== investor.id) return { ok: false, fieldErrors: {}, formError: 'phoneTaken' };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.investor.update({
        where: { id: investor.id },
        data: {
          name: parsed.data.name,
          phone: parsed.data.phone,
          nationalIdNumber: parsed.data.nationalIdNumber,
          address: parsed.data.address ?? null,
          tin: parsed.data.tin ?? null,
        },
      });
      await writeAuditLog(
        {
          actorType: ActorType.INVESTOR,
          actorId: investor.id,
          action: actionVerbs.investorProfileUpdate,
          targetType: 'Investor',
          targetId: investor.id,
          ipAddress: realIp ?? forwardedIp,
          userAgent: h.get('user-agent'),
        },
        tx,
      );
    });
    revalidatePath('/portal/account');
    revalidatePath('/portal');
    return { ok: true };
  } catch {
    return { ok: false, fieldErrors: {}, formError: 'generic' };
  }
}
