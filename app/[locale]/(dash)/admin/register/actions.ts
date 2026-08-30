'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { AuthError, requireStaff } from '@/lib/auth';
import { registerInvestment } from '@/lib/investments';
import { registerInvestmentSchema } from '@/lib/validation';
import { ZodError } from 'zod';
import { demoRegisterInvestment, isDemoData } from '@/data/demo/store';

export type RegisterState = { ok: false; fieldErrors: Record<string, string[]>; formError?: string } | { ok: true; uid: string; code: string; id?: string };

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
    nationalIdNumber: (() => { const v = String(formData.get('nationalIdNumber') ?? '').trim(); return v ? v : undefined; })(),
    depositRef: (() => { const v = String(formData.get('depositRef') ?? '').trim(); return v ? v : undefined; })(),
    notes: (() => { const v = String(formData.get('notes') ?? '').trim(); return v ? v : undefined; })(),
  };
  const parsed = registerInvestmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };
  const h = await headers();
  const realIp = h.get('x-real-ip')?.trim() ?? null;
  const forwardedFor = h.get('x-forwarded-for');
  const forwardedIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() ?? null : null;
  const meta = { ipAddress: realIp ?? forwardedIp, userAgent: h.get('user-agent') };
  if (isDemoData()) {
    const created = demoRegisterInvestment(parsed.data);
    revalidatePath('/admin');
    revalidatePath('/admin/register');
    return { ok: true, uid: created.uid, code: created.code, id: created.id };
  }
  try {
    const created = await registerInvestment(parsed.data, staff.id, meta);
    revalidatePath('/admin');
    return { ok: true, uid: created.uid, code: created.code, id: created.id };
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, fieldErrors: { shares: [error.message] } };
    throw error;
  }
}
