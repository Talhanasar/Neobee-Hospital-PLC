'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { completeLoginAction, demoPasswordLoginAction } from '@/app/[locale]/(auth)/login/actions';
import { isDemoClient } from '@/data/demo/client';
import { btnClasses } from '@/components/ui/bits';

/**
 * Email + password sign-in. The email/password pair is established during
 * registration (where an OTP sent to the email confirms the address); this
 * form never sends OTPs.
 */
export default function LoginForm({ footer }: { footer?: React.ReactNode }) {
  const t = useTranslations('login');
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (isDemoClient()) {
        // Demo mode: no Supabase — the server action checks the in-memory
        // demo accounts (including ones registered during this demo run).
        const result = await demoPasswordLoginAction(email, password);
        if (!result.ok) throw new Error(t('errorGeneric'));
        router.push(result.role === 'admin' ? '/admin' : '/portal');
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      const result = await completeLoginAction();
      if (result.needsProfile) {
        // Legacy accounts created before the wizard: send them to the wizard
        // to finish registration (details + share request) in one pass.
        router.push('/register');
        return;
      }
      router.push('/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const focusRing = 'focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            {t('emailLabel')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            className={`nb-input ${focusRing}`}
          />
          <p className="text-xs text-ink-soft">{t('emailHelper')}</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            {t('passwordLabel')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={`nb-input ${focusRing}`}
          />
        </div>

        <button type="submit" disabled={loading} className={`${btnClasses('primary', 'lg')} w-full ${focusRing}`}>
          {loading ? t('verifying') : t('verify')}
        </button>
      </form>

      <div role="status" aria-live="polite">
        {message ? <div className="rounded-xl border border-green/30 bg-green-soft/60 px-3.5 py-2.5 text-sm text-green">{message}</div> : null}
        {error ? (
          <div role="alert" className="rounded-xl border border-amber/40 bg-amber-soft/70 px-3.5 py-2.5 text-sm text-ink">
            {error}
          </div>
        ) : null}
      </div>
      {footer}
    </div>
  );
}
