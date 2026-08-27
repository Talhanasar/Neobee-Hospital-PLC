'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { completeLoginAction } from '@/app/[locale]/(auth)/login/actions';
import { Button } from '@/components/ui/Button';

export default function LoginForm({ mode = 'login', footer }: { mode?: 'login' | 'register'; footer?: React.ReactNode }) {
  const t = useTranslations('login');
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [step, setStep] = React.useState<1 | 2>(1);
  const [phone, setPhone] = React.useState('');
  const [token, setToken] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const normalize = (value: string) => {
    const trimmed = value.trim();
    return trimmed.startsWith('880') && !trimmed.startsWith('+') ? `+${trimmed}` : trimmed;
  };

  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: normalize(phone) });
      if (error) throw error;
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: normalize(phone) });
      if (error) throw error;
      setMessage(t('sendCode'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: normalize(phone), token, type: 'sms' });
      if (error) throw error;
      const result = await completeLoginAction();
      if (mode === 'register') {
        if (result.needsProfile) {
          router.push('/register/profile');
          return;
        }
        if (result.hasRecord) {
          router.push('/portal');
          return;
        }
        setMessage(t('noRecordHint'));
        return;
      }
      if (!result.hasRecord) {
        setMessage(t('noRecordHint'));
        return;
      }
      router.push('/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return <div className="space-y-4"><form onSubmit={step === 1 ? submitPhone : submitCode} className="space-y-3">{step === 1 ? <div className="space-y-1.5"><label htmlFor="phone" className="text-sm font-semibold text-ink">{t('phoneLabel')}</label><input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01700-000000" className="w-full rounded-lg border border-line bg-panel px-3.5 py-2.5 focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2" /><p className="text-sm text-ink-soft">{t('phoneHelper')}</p></div> : <div className="space-y-1.5"><label htmlFor="code" className="text-sm font-semibold text-ink">{t('codeLabel')}</label><input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={token} onChange={(e) => setToken(e.target.value)} className="w-full rounded-lg border border-line bg-panel px-3.5 py-2.5 focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2" /><p className="text-sm text-ink-soft">{t('codeHelper')}</p></div>}<Button type="submit" variant="primary" disabled={loading}>{step === 1 ? (loading ? t('sending') : t('sendCode')) : (loading ? t('verifying') : mode === 'register' ? t('registerSubmit') : t('verify'))}</Button>{step === 2 ? <div className="flex gap-3"><Button type="button" onClick={() => { setStep(1); setToken(''); }} disabled={loading}>{t('changeNumber')}</Button><Button type="button" onClick={resendCode} disabled={loading}>{t('resend')}</Button></div> : null}</form><div role="status" aria-live="polite">{message ? <p>{message}</p> : null}{error ? <p role="alert">{error}</p> : null}</div>{footer}</div>;
}
