'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { AuthError, getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { linkInvestorToAuthUser } from '@/lib/link-investor';
import { normalizeBangladeshiPhone } from '@/lib/validation';
import { createInvestorProfileSchema } from '@/lib/validation';
import { writeAuditLog, actionVerbs } from '@/lib/audit';
import { ActorType } from '@/lib/generated/prisma/client';
import { ZodError } from 'zod';
import { DEMO_INVESTOR, DEMO_ADMIN, isDemoLoginEnabled } from '@/lib/demo-users';

export async function completeLoginAction(): Promise<{ ok: boolean; hasRecord: boolean; needsProfile: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, hasRecord: false, needsProfile: false };
  const phone = (data.user.user_metadata?.phone ?? data.user.phone ?? '') as string;
  const result = await linkInvestorToAuthUser(data.user.id, phone);
  // needsProfile = true when the verified phone has NO Investor row (neither linked nor matchable by phone)
  const needsProfile = !result.linked;
  revalidatePath('/portal');
  return { ok: true, hasRecord: result.linked, needsProfile };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

export type DemoLoginResult =
  | { ok: true; role: 'investor' | 'admin' }
  | { ok: false; error: 'demoDisabled' | 'demoFailed' };

// One-click demo sign-in for presentations. Signs in with a seeded
// phone+password via the SSR server client (cookies persist the session,
// per the @supabase/ssr server-action pattern), then returns the role so
// the client wrapper can route to the right dashboard.
export async function demoLoginAction(role: 'investor' | 'admin'): Promise<DemoLoginResult> {
  if (!isDemoLoginEnabled()) return { ok: false, error: 'demoDisabled' };

  const credentials = role === 'investor'
    ? { email: DEMO_INVESTOR.email, password: DEMO_INVESTOR.password }
    : { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error) return { ok: false, error: 'demoFailed' };

  // Reuse the same post-login linking step as completeLoginAction so the
  // demo investor's auth user is linked to their Investor row on first login.
  if (role === 'investor') {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const phone = (userData.user.user_metadata?.phone ?? userData.user.phone ?? '') as string;
      await linkInvestorToAuthUser(userData.user.id, phone);
    }
  }

  revalidatePath('/portal');
  return { ok: true, role };
}

function flattenFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : 'form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export type CreateInvestorProfileState =
  | { ok: false; fieldErrors: Record<string, string[]>; formError?: string }
  | { ok: true; investorId: string };

export async function createInvestorProfileAction(
  prevState: CreateInvestorProfileState,
  formData: FormData
): Promise<CreateInvestorProfileState> {
  // Auth gate: require an authenticated session
  let authUser;
  try {
    authUser = await getAuthUser();
    if (!authUser) throw new AuthError('Unauthenticated', 401);
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, fieldErrors: {}, formError: error.message };
    throw error;
  }

  // Read phone from verified Supabase session (NEVER from form body)
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, fieldErrors: {}, formError: 'Session not found. Please sign in again.' };
  }

  const rawPhone = userData.user.user_metadata?.phone ?? userData.user.phone ?? '';
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeBangladeshiPhone(rawPhone);
  } catch {
    return { ok: false, fieldErrors: { phone: ['Invalid phone number in session'] }, formError: 'Invalid session phone' };
  }

  // Validate profile fields (name, email, nationalIdNumber)
  const raw = {
    name: formData.get('name'),
    email: (() => { const v = String(formData.get('email') ?? '').trim(); return v ? v : undefined; })(),
    nationalIdNumber: (() => { const v = String(formData.get('nationalIdNumber') ?? '').trim(); return v ? v : undefined; })(),
  };
  const parsed = createInvestorProfileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };

  // Get request metadata for audit
  const h = await headers();
  const realIp = h.get('x-real-ip')?.trim() ?? null;
  const forwardedFor = h.get('x-forwarded-for');
  const forwardedIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() ?? null : null;
  const requestMeta = { ipAddress: realIp ?? forwardedIp, userAgent: h.get('user-agent') };

  try {
    return await prisma.$transaction(async (tx) => {
      // Check if an Investor with this phone already exists
      const existing = await tx.investor.findUnique({ where: { phone: normalizedPhone } });

      let investorId: string;

      if (existing) {
        // Investor exists — link it to the auth user if not already linked
        if (existing.authUserId && existing.authUserId !== authUser.id) {
          return { ok: false, fieldErrors: {}, formError: 'This phone is already linked to another account' };
        }
        if (!existing.authUserId) {
          await tx.investor.update({
            where: { id: existing.id },
            data: { authUserId: authUser.id },
          });
        }
        investorId = existing.id;
      } else {
        // Create new Investor row with authUserId and phone from session
        const created = await tx.investor.create({
          data: {
            phone: normalizedPhone,
            name: parsed.data.name,
            email: parsed.data.email ?? null,
            nationalIdNumber: parsed.data.nationalIdNumber ?? null,
            authUserId: authUser.id,
          },
        });
        investorId = created.id;
      }

      // Write audit log
      await writeAuditLog(
        {
          actorType: ActorType.INVESTOR,
          actorId: authUser.id,
          action: actionVerbs.investorRegister,
          targetType: 'Investor',
          targetId: investorId,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
          metadata: { name: parsed.data.name, phone: normalizedPhone },
        },
        tx,
      );

      revalidatePath('/portal');
      return { ok: true, investorId };
    });
  } catch (error) {
    // Handle race condition: P2002 unique constraint on phone
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      const target = (error as { meta?: { target?: unknown } }).meta?.target;
      if (Array.isArray(target) && target.includes('phone')) {
        return { ok: false, fieldErrors: {}, formError: 'An investor with this phone already exists. Please sign in instead.' };
      }
    }
    throw error;
  }
}
