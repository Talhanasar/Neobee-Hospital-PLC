import 'server-only';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from './password';
import { sendOtpEmail } from './mailer';
import { getRequestMetadataFromHeaders } from '@/lib/audit';
import {
  setSessionCookie,
  clearSessionCookie,
  getSessionCookieToken,
} from './cookies';
import * as store from './store';

// Lazily materialised dummy hash so the sign-in path always runs scrypt once,
// whether or not the account exists — equalising timing to resist user
// enumeration. The first not-found attempt also pays for this one-time
// computation; subsequent attempts reuse the cached hash.
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('neobee-own-auth-dummy');
  }
  return dummyHashPromise;
}

// Creates an INVESTOR account (email unverified) and issues an EMAIL_VERIFY OTP.
// The code is returned so the calling server action can mail it via sendOtpEmail.
export async function signUpInvestor(email: string, password: string) {
  const result = await store.createAuthUser(email, password, 'INVESTOR');
  if (!result.ok) {
    return result; // { ok: false, error: 'emailTaken' }
  }
  const code = await store.issueOtp(email, 'EMAIL_VERIFY');
  return { ok: true as const, code };
}

// Re-issues an EMAIL_VERIFY OTP and returns the code so the action can mail it
// (mirrors signUpInvestor's contract). The user is not required to exist — the
// caller decides whether to send the email.
export async function sendVerificationOtp(email: string) {
  const code = await store.issueOtp(email, 'EMAIL_VERIFY');
  return { ok: true as const, code };
}

export async function signIn(email: string, password: string) {
  const user = await store.findAuthUserByEmail(email);
  const storedHash = user?.passwordHash ?? (await dummyHash());
  const ok = await verifyPassword(password, storedHash);
  if (!user || !ok) {
    return { ok: false as const, error: 'invalidCredentials' as const };
  }
  const { ipAddress, userAgent } = await getRequestMetadataFromHeaders();
  const token = await store.createSession(user.id, { ip: ipAddress, userAgent });
  await setSessionCookie(token);
  return { ok: true as const };
}

export async function signOut() {
  const token = await getSessionCookieToken();
  if (token) {
    await store.revokeSession(token);
  }
  await clearSessionCookie();
  return { ok: true as const };
}

export async function getCurrentUser() {
  const token = await getSessionCookieToken();
  if (!token) return null;
  const user = await store.getSessionUser(token);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

export async function verifyEmailOtp(email: string, code: string) {
  const matched = await store.verifyOtp(email, 'EMAIL_VERIFY', code);
  if (!matched) {
    return { ok: false as const, error: 'invalidOrExpiredOtp' as const };
  }
  await prisma.authUser.update({
    where: { email: email.toLowerCase() },
    data: { emailVerifiedAt: new Date() },
  });
  return { ok: true as const };
}

// Always returns { ok: true } to avoid enumerating accounts. When no user
// exists for the email, nothing is sent.
export async function requestPasswordReset(email: string) {
  const user = await store.findAuthUserByEmail(email);
  if (user) {
    const code = await store.issueOtp(email, 'PASSWORD_RESET');
    await sendOtpEmail(user.email, code, 'PASSWORD_RESET');
  }
  return { ok: true as const };
}

export async function resetPasswordWithOtp(email: string, code: string, newPassword: string) {
  const matched = await store.verifyOtp(email, 'PASSWORD_RESET', code);
  if (!matched) {
    return { ok: false as const, error: 'invalidOrExpiredOtp' as const };
  }
  const user = await store.findAuthUserByEmail(email);
  if (!user) {
    // An OTP can only match for a known address; guard defensively anyway.
    return { ok: false as const, error: 'invalidOrExpiredOtp' as const };
  }
  await prisma.authUser.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await store.revokeAllSessionsForUser(user.id);
  return { ok: true as const };
}
