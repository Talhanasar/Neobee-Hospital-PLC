'use server';

import { sendVerificationOtp, verifyEmailOtp, signIn } from '@/lib/auth-own';
import { sendOtpEmail } from '@/lib/auth-own/mailer';

export async function sendOtpAction(email: string): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.trim().toLowerCase();
  const res = await sendVerificationOtp(normalized);
  await sendOtpEmail(normalized, res.code, 'EMAIL_VERIFY');
  return { ok: true };
}

export async function verifyOtpAction(
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
    const loginRes = await signIn(normalized, password);
    if (!loginRes.ok) {
      return { ok: false, error: loginRes.error };
    }
  }
  return { ok: true };
}
