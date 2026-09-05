'use server';

import { getCurrentUser, requestPasswordReset, resetPasswordWithOtp, signIn } from '@/lib/auth-own';
import { isDemoData } from '@/data/demo/store';
import { demoChangePasswordAction } from '@/app/[locale]/(auth)/login/actions';

export async function sendPasswordResetOtpAction(): Promise<{ ok: boolean; error?: string }> {
  if (isDemoData()) {
    return { ok: true };
  }
  const user = await getCurrentUser();
  if (!user || !user.email) {
    return { ok: false, error: 'unauthenticated' };
  }
  await requestPasswordReset(user.email);
  return { ok: true };
}

export async function changePasswordWithOtpAction(
  code: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if (isDemoData()) {
    return demoChangePasswordAction(newPassword);
  }
  const user = await getCurrentUser();
  if (!user || !user.email) {
    return { ok: false, error: 'unauthenticated' };
  }
  const result = await resetPasswordWithOtp(user.email, code.trim(), newPassword);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  // Re-establish session after password reset
  await signIn(user.email, newPassword);
  return { ok: true };
}
