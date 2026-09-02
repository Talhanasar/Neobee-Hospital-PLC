'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { demoChangePasswordAction } from '@/app/[locale]/(auth)/login/actions';
import { isDemoClient } from '@/data/demo/client';
import { btnClasses } from '@/components/ui/bits';

/**
 * Change-password flow for a signed-in user (investor or staff):
 *   1. "Send code" — Supabase emails a 6-digit OTP (recovery type) to the
 *      signed-in user's email.
 *   2. Enter code + new password — verifyOtp re-establishes the session,
 *      then updateUser writes the new password.
 * The signed-in session is not enough on its own: the emailed code proves
 * control of the mailbox before a credential change.
 */
export default function PasswordChangeForm() {
  const t = useTranslations('portal');
  const supabase = React.useMemo(() => createClient(), []);
  const [otp, setOtp] = React.useState('');
  const [otpSent, setOtpSent] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sendCode = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      // Demo: no email gateway — go straight to the code step (any 6 digits verify).
      if (isDemoClient()) {
        setOtpSent(true);
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const target = (userData.user?.email ?? '').trim();
      if (!target) {
        setError(t('otpEmailRequired'));
        return;
      }
      const { error: otpError } = await supabase.auth.resetPasswordForEmail(target);
      if (otpError) throw otpError;
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (otp.trim().length !== 6) {
      setError(t('otpErrLength'));
      return;
    }
    if (password.length < 8) {
      setError(t('errPasswordShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('errPasswordMismatch'));
      return;
    }
    setLoading(true);
    try {
      if (isDemoClient()) {
        // Demo: no email gateway — any 6-digit code verifies.
        const result = await demoChangePasswordAction(password);
        if (!result.ok) throw new Error(t('errorGeneric'));
        setDone(true);
        setPassword('');
        setConfirmPassword('');
        setOtp('');
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const target = (userData.user?.email ?? '').trim();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: target,
        token: otp.trim(),
        type: 'recovery',
      });
      if (verifyError) {
        setError(t('otpErrWrong'));
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setPassword('');
      setConfirmPassword('');
      setOtp('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const focusRing = 'focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {done ? (
        <div role="status" className="rounded-xl border border-green/30 bg-green-soft/60 px-3.5 py-2.5 text-sm text-green">
          {t('passwordChanged')}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-xl border border-amber/40 bg-amber-soft/70 px-3.5 py-2.5 text-sm text-ink">
          {error}
        </div>
      ) : null}

      {otpSent ? (
        <>
          <p className="text-sm leading-relaxed text-ink-soft">{t('otpChangeSentBody')}</p>
          <div className="space-y-1.5">
            <label htmlFor="otp-code" className="block text-sm font-medium text-ink">{t('otpCodeLabel')}</label>
            <input
              id="otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              className={`nb-input text-center font-mono tracking-[0.4em] ${focusRing}`}
            />
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <p className="text-sm leading-relaxed text-ink-soft">{t('otpChangeIntro')}</p>
          <button
            type="button"
            onClick={sendCode}
            disabled={loading}
            className={`${btnClasses('soft', 'md')} w-full ${focusRing}`}
          >
            {loading ? t('changing') : t('otpSendCode')}
          </button>
        </div>
      )}

      {otpSent ? (
        <>
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="block text-sm font-medium text-ink">{t('newPassword')}</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              className={`nb-input ${focusRing}`}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="block text-sm font-medium text-ink">{t('confirmPassword')}</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
              className={`nb-input ${focusRing}`}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={sendCode} disabled={loading} className={`${btnClasses('ghost', 'md')} ${focusRing}`}>
              {t('otpResendCode')}
            </button>
            <button type="submit" disabled={loading} className={`${btnClasses('primary', 'md')} flex-1 ${focusRing}`}>
              {loading ? t('changing') : t('changeSubmit')}
            </button>
          </div>
        </>
      ) : null}
    </form>
  );
}
