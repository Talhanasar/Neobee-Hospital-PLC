'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { AuthError, getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { signIn, signOut, getCurrentUser } from '@/lib/auth-own';
import { linkInvestorToAuthUser } from '@/lib/link-investor';
import { completeRegistrationSchema } from '@/lib/validation';
import { writeAuditLog, actionVerbs, getRequestMetadataFromHeaders } from '@/lib/audit';
import { countRecentAttempts } from '@/lib/rate-limit';
import { ActorType } from '@/lib/generated/prisma/client';
import { ZodError } from 'zod';
import { DEMO_INVESTOR, DEMO_INVESTOR_KISTI, DEMO_ADMIN, isDemoLoginEnabled } from '@/lib/demo-users';
import { isDemoData } from '@/data/demo/store';

export type LoginResult =
  | { ok: true; role: 'admin' | 'investor'; needsProfile: boolean }
  | { ok: false; error: 'invalidCredentials' | 'unauthenticated' | 'generic' };

export async function loginAction(email: string, password: string): Promise<LoginResult> {
  const normEmail = email.trim().toLowerCase();
  const result = await signIn(normEmail, password);
  if (!result.ok) {
    return { ok: false, error: 'invalidCredentials' };
  }
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: 'unauthenticated' };
  }
  if (user.role === 'ADMIN' || user.role === 'STAFF') {
    revalidatePath('/admin');
    return { ok: true, role: 'admin', needsProfile: false };
  }
  const investor = await prisma.investor.findUnique({
    where: { authUserId: user.id },
    select: { id: true },
  });
  const needsProfile = investor === null;
  revalidatePath('/portal');
  return { ok: true, role: 'investor', needsProfile };
}

export async function completeLoginAction(): Promise<{ ok: boolean; hasRecord: boolean; needsProfile: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, hasRecord: false, needsProfile: false };
  // Email is the auth identity; the deposit phone is claimed later on the
  // profile step (linked with an NID match). Here we only check whether the
  // auth user already has an Investor row.
  const investor = await prisma.investor.findUnique({ where: { authUserId: user.id }, select: { id: true } });
  const hasRecord = investor !== null;
  revalidatePath('/portal');
  return { ok: true, hasRecord, needsProfile: !hasRecord };
}

export async function signOutAction(): Promise<void> {
  if (isDemoData()) {
    // Demo session is a plain cookie — clearing it is the whole logout.
    const jar = await cookies();
    jar.delete('neobee-demo-role');
    revalidatePath('/', 'layout');
    redirect('/');
  }
  await signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

export type DemoLoginResult =
  | { ok: true; role: 'investor' | 'investor-kisti' | 'admin' }
  | { ok: false; error: 'demoDisabled' | 'demoFailed' };

// One-click demo sign-in for presentations. Signs in with a seeded
// credentials via own-auth backend (cookies persist the session),
// then returns the role so the client wrapper can route to the right dashboard.
// 'investor-kisti' is the second demo identity (installment investor); it
// exists in DEMO_DATA mode and against the seeded database (demo-kisti@neobee.test).
export async function demoLoginAction(role: 'investor' | 'investor-kisti' | 'admin'): Promise<DemoLoginResult> {
  if (!isDemoLoginEnabled()) return { ok: false, error: 'demoDisabled' };

  // Demo data mode: the session is a signed-out-by-default cookie — no
  // database dependency. The demo dataset carries the identities.
  if (isDemoData()) {
    const jar = await cookies();
    jar.set('neobee-demo-role', role, { httpOnly: true, sameSite: 'lax', path: '/' });
    revalidatePath('/portal');
    return { ok: true, role };
  }

  const credentials =
    role === 'admin'
      ? { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password }
      : role === 'investor-kisti'
        ? { email: DEMO_INVESTOR_KISTI.email, password: DEMO_INVESTOR_KISTI.password }
        : { email: DEMO_INVESTOR.email, password: DEMO_INVESTOR.password };

  const result = await signIn(credentials.email, credentials.password);
  if (!result.ok) return { ok: false, error: 'demoFailed' };

  // Reuse the same post-login linking step as completeLoginAction so the
  // demo investor's auth user is linked to their Investor row on first login.
  if (role !== 'admin') {
    const user = await getCurrentUser();
    if (user) {
      const phone = role === 'investor-kisti' ? DEMO_INVESTOR_KISTI.phone : DEMO_INVESTOR.phone;
      await linkInvestorToAuthUser(user.id, phone);
    }
  }

  revalidatePath('/portal');
  return { ok: true, role };
}

export type DemoPhoneLoginResult =
  | { ok: true; role: 'investor' | 'investor-kisti' | 'admin' }
  | { ok: false; error: 'invalidCredentials' };

/** Demo-mode email+password sign-in against the in-memory accounts (the
    seeded demo users plus anyone registered during this demo run). */
export async function demoPasswordLoginAction(email: string, password: string): Promise<DemoPhoneLoginResult> {
  if (!isDemoData()) return { ok: false, error: 'invalidCredentials' };
  const { demoSignInWithPassword } = await import('@/data/demo/store');
  const role = demoSignInWithPassword(email, password);
  if (!role) return { ok: false, error: 'invalidCredentials' };
  const jar = await cookies();
  jar.set('neobee-demo-role', role, { httpOnly: true, sameSite: 'lax', path: '/' });
  revalidatePath('/portal');
  const coarse = role.startsWith('investor') ? 'investor' : role;
  return { ok: true, role: coarse as 'investor' | 'admin' };
}

export type DemoSignUpResult =
  | { ok: true }
  | { ok: false; error: 'duplicateEmail' | 'duplicatePhone' | 'notDemo' };

const REGISTRATION_CHECK_LIMIT = 20;
const REGISTRATION_CHECK_WINDOW_MS = 60 * 60 * 1000;

/** Registration pre-check: is this email already registered, and approved?
    Lets the register form tell an already-registered visitor what to do
    (log in vs. wait for admin approval) before any account is created.
    Logged and rate-limited per IP: it answers "is this email registered?",
    which is an enumeration vector if left unthrottled. */
export async function checkRegistrationStatusAction(
  email: string,
): Promise<{ registered: boolean; approved: boolean } | { error: 'rateLimited' }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { registered: false, approved: false };
  if (isDemoData()) {
    const { demoRegistrationStatusForEmail } = await import('@/data/demo/store');
    return demoRegistrationStatusForEmail(normalized);
  }
  const meta = await getRequestMetadataFromHeaders();
  const recent = await countRecentAttempts({
    action: actionVerbs.registrationStatusCheck,
    ipAddress: meta.ipAddress,
    windowMs: REGISTRATION_CHECK_WINDOW_MS,
  });
  if (recent >= REGISTRATION_CHECK_LIMIT) return { error: 'rateLimited' };
  // Log every allowed probe (ones over the ceiling are dropped without a
  // row, matching the verify endpoint) so abuse stays attributable.
  await writeAuditLog({
    actorType: ActorType.PUBLIC,
    actorId: null,
    action: actionVerbs.registrationStatusCheck,
    targetType: 'Investor',
    targetId: normalized,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  const investor = await prisma.investor.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { approvalStatus: true },
  });
  if (!investor) return { registered: false, approved: false };
  return { registered: true, approved: investor.approvalStatus === 'APPROVED' };
}

/** Demo-mode registration step 1/2: create the account (email is the auth
    identity). OTP always verifies in demo — no email gateway locally. */
export async function demoSignUpAction(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  nationalIdNumber?: string | null;
}): Promise<DemoSignUpResult> {
  if (!isDemoData()) return { ok: false, error: 'notDemo' };
  const { demoSignUp } = await import('@/data/demo/store');
  return demoSignUp(input);
}

/** Demo-mode password change for the signed-in session. */
export async function demoChangePasswordAction(newPassword: string): Promise<{ ok: boolean }> {
  if (!isDemoData()) return { ok: false };
  const { demoChangePassword } = await import('@/data/demo/store');
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false };
  return { ok: demoChangePassword(authUser.id, newPassword) };
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
  | { ok: true; investorId: string; approvalStatus: 'PENDING' | 'APPROVED' };

export async function createInvestorProfileAction(
  prevState: CreateInvestorProfileState,
  formData: FormData,
): Promise<CreateInvestorProfileState> {
  // Auth gate: require an authenticated session
  let authUser;
  try {
    authUser = await getAuthUser();
    if (!authUser) throw new AuthError('Unauthenticated', 401);
  } catch (error) {
    // Stable code, not the raw error text — the client maps it to a
    // friendly localized message ("try logging in / contact the admin").
    if (error instanceof AuthError) return { ok: false, fieldErrors: {}, formError: 'unauthenticated' };
    throw error;
  }

  // Demo data mode: link the submitted profile details to the cookie session.
  if (isDemoData()) {
    const raw = {
      name: formData.get('name'),
      email: String(formData.get('email') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim(),
      nationalIdNumber: String(formData.get('nationalIdNumber') ?? '').trim(),
    };
    const parsed = completeRegistrationSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };
    const { demoCompleteProfile, demoInvestorForAuthUser } = await import('@/data/demo/store');
    demoCompleteProfile(authUser.id, {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      nationalIdNumber: parsed.data.nationalIdNumber,
    });
    revalidatePath('/portal');
    return { ok: true, investorId: authUser.id, approvalStatus: demoInvestorForAuthUser(authUser.id)?.approvalStatus ?? 'PENDING' };
  }

  // The auth user is the verified email. The deposit phone is claimed here —
  // since email auth never proves the phone, an existing staff-created record
  // is linked only when BOTH the phone and the NID match it.
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { ok: false, fieldErrors: {}, formError: 'unauthenticated' };
  }
  const sessionEmail = currentUser.email?.trim().toLowerCase() ?? '';

  const raw = {
    name: formData.get('name'),
    email: String(formData.get('email') ?? '').trim() || sessionEmail,
    phone: formData.get('phone'),
    nationalIdNumber: String(formData.get('nationalIdNumber') ?? '').trim(),
  };
  const parsed = completeRegistrationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };

  const requestMeta = await getRequestMetadataFromHeaders();

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.investor.findUnique({ where: { phone: parsed.data.phone } });

      let investorId: string;

      if (existing) {
        if (existing.authUserId && existing.authUserId !== authUser.id) {
          return { ok: false, fieldErrors: {}, formError: 'This mobile number is already linked to another account' };
        }
        // Knowledge check: the claimed phone must pair with the recorded NID.
        // Records without an NID on file can never be self-claimed.
        if (!existing.nationalIdNumber || existing.nationalIdNumber !== parsed.data.nationalIdNumber) {
          return { ok: false, fieldErrors: {}, formError: 'noMatch' };
        }
        if (!existing.authUserId) {
          // Phone + NID both matched a staff-created record — the desk already
          // knows this person, so linking grants portal access immediately.
          await tx.investor.update({
            where: { id: existing.id },
            data: { authUserId: authUser.id, email: existing.email ?? parsed.data.email, approvalStatus: 'APPROVED' },
          });
        }
        investorId = existing.id;
      } else {
        // No record for this phone — create a fresh investor for this account.
        const created = await tx.investor.create({
          data: {
            phone: parsed.data.phone,
            name: parsed.data.name,
            email: parsed.data.email,
            nationalIdNumber: parsed.data.nationalIdNumber,
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
          metadata: { name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email },
        },
        tx,
      );

      const final = await tx.investor.findUniqueOrThrow({ where: { id: investorId }, select: { approvalStatus: true } });
      revalidatePath('/portal');
      return { ok: true, investorId, approvalStatus: final.approvalStatus };
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
