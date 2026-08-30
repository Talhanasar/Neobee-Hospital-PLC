'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { demoChangePasswordAction } from '@/app/[locale]/(auth)/login/actions';
import { isDemoClient } from '@/data/demo/client';
import { btnClasses } from '@/components/ui/bits';

/**
 * Change-password form for a signed-in investor. Runs the Supabase
 * update through the SSR server client so the session cookie stays
 * authoritative.
 */
export default function PasswordChangeForm() {
  const t = useTranslations('portal');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (password.length < 6) {
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
        // Demo: update the in-memory password for this session's identity.
        const result = await demoChangePasswordAction(password);
        if (!result.ok) throw new Error(t('errorGeneric'));
        setDone(true);
        setPassword('');
        setConfirmPassword('');
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setPassword('');
      setConfirmPassword('');
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
      <div className="space-y-1.5">
        <label htmlFor="new-password" className="block text-sm font-medium text-ink">{t('newPassword')}</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
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
          minLength={6}
          required
          className={`nb-input ${focusRing}`}
        />
      </div>
      <button type="submit" disabled={loading} className={`${btnClasses('primary', 'md')} ${focusRing}`}>
        {loading ? t('changing') : t('changeSubmit')}
      </button>
    </form>
  );
}
