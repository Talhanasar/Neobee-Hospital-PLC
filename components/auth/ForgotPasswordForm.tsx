'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { btnClasses } from '@/components/ui/bits';
import {
  requestForgotPasswordOtpAction,
  resetForgotPasswordAction,
} from '@/app/[locale]/(auth)/forgot-password/actions';

const ERROR_KEY: Record<string, string> = {
  invalidOrExpiredOtp: 'errCode',
  passwordShort: 'errPasswordShort',
  demoUnsupported: 'errGeneric',
};

export function ForgotPasswordForm() {
  const t = useTranslations('forgotPassword');
  const router = useRouter();
  const [step, setStep] = React.useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const focusRing = 'focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await requestForgotPasswordOtpAction(email);
      if (!result.ok) {
        setError(t(ERROR_KEY[result.error ?? ''] ?? 'errGeneric'));
        return;
      }
      setStep('code');
    } catch {
      setError(t('errGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (newPassword !== confirmPassword) {
      setError(t('errMismatch'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await resetForgotPasswordAction(email, code, newPassword);
      if (!result.ok) {
        setError(t(ERROR_KEY[result.error ?? ''] ?? 'errGeneric'));
        return;
      }
      setStep('done');
      if (result.role) {
        // Signed back in automatically — straight to the right dashboard.
        setTimeout(() => router.push(result.role === 'admin' ? '/admin' : '/portal'), 1600);
      }
    } catch {
      setError(t('errGeneric'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="space-y-4 text-center">
        <div role="status" className="rounded-xl border border-green/30 bg-green-soft/60 px-4 py-3 text-sm text-green">
          {t('successTitle')}
        </div>
        <p className="text-sm text-ink-soft">{t('successBody')}</p>
        <Link href="/login" className={btnClasses('primary', 'lg') + ` w-full ${focusRing}` + ' inline-flex items-center justify-center'}>
          {t('backToLogin')}
        </Link>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={reset} className="space-y-4" noValidate>
        <div role="status" className="rounded-xl border border-green/30 bg-green-soft/60 px-3.5 py-2.5 text-sm text-green">
          {t('sentBody', { email })}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="fp-code" className="block text-sm font-medium text-ink">{t('codeLabel')}</label>
          <input
            id="fp-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            className={`nb-input ${focusRing}`}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="fp-new" className="block text-sm font-medium text-ink">{t('newPasswordLabel')}</label>
          <input
            id="fp-new"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
            className={`nb-input ${focusRing}`}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="fp-confirm" className="block text-sm font-medium text-ink">{t('confirmPasswordLabel')}</label>
          <input
            id="fp-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
            className={`nb-input ${focusRing}`}
          />
        </div>
        {error ? <div role="alert" className="rounded-xl border border-amber/40 bg-amber-soft/70 px-3.5 py-2.5 text-sm text-ink">{error}</div> : null}
        <Button type="submit" variant="primary" disabled={loading} className={`w-full ${focusRing}`}>
          {loading ? t('submitting') : t('submit')}
        </Button>
        <button
          type="button"
          onClick={() => requestForgotPasswordOtpAction(email)}
          className="text-xs text-ink-soft underline hover:text-ink"
        >
          {t('resend')}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="fp-email" className="block text-sm font-medium text-ink">{t('emailLabel')}</label>
        <input
          id="fp-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          required
          className={`nb-input ${focusRing}`}
        />
      </div>
      {error ? <div role="alert" className="rounded-xl border border-amber/40 bg-amber-soft/70 px-3.5 py-2.5 text-sm text-ink">{error}</div> : null}
      <Button type="submit" variant="primary" disabled={loading} className={`w-full ${focusRing}`}>
        {loading ? t('sending') : t('sendCode')}
      </Button>
      <p className="text-center text-xs text-ink-soft">
        <Link href="/login" className="underline hover:text-ink">{t('backToLogin')}</Link>
      </p>
    </form>
  );
}
