'use server';

import { isDemoData } from '@/data/demo/store';
import { requestPasswordReset } from '@/lib/auth-own';
import { loginAction } from '@/app/[locale]/(auth)/login/actions';

// Anti-enumeration: always reports ok — the OTP is only actually sent when the
// email owns an account (requestPasswordReset handles that silently).
export async function requestForgotPasswordOtpAction(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: 'invalidEmail' };
  }
  if (isDemoData()) {
    // The in-memory demo store has no mailer or persisted accounts; the flow is
    // a no-op there. Real password resets need a seeded/real database.
    return { ok: true };
  }
  await requestPasswordReset(normalized);
  return { ok: true };
}

// On success the user is signed straight back in (they just proved email
// ownership via OTP), so they land on their dashboard with the new password.
// resetPasswordWithOtp also revokes every existing session first.
export async function resetForgotPasswordAction(
  email: string,
  code: string,
  newPassword: string,
): Promise<{ ok: boolean; role?: 'admin' | 'investor'; error?: string }> {
  const normalized = email.trim().toLowerCase();
  if (newPassword.length < 8) {
    return { ok: false, error: 'passwordShort' };
  }
  if (isDemoData()) {
    return { ok: false, error: 'demoUnsupported' };
  }
  const { resetPasswordWithOtp } = await import('@/lib/auth-own');
  const result = await resetPasswordWithOtp(normalized, code.trim(), newPassword);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  const login = await loginAction(normalized, newPassword);
  if (!login.ok) {
    // Password was reset; the user just has to sign in manually.
    return { ok: true };
  }
  return { ok: true, role: login.role };
}
