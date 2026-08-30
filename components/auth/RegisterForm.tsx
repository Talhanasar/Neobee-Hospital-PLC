'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkRegistrationStatusAction, createInvestorProfileAction, demoPasswordLoginAction, demoSignUpAction } from '@/app/[locale]/(auth)/login/actions';
import { isDemoClient } from '@/data/demo/client';
import { btnClasses } from '@/components/ui/bits';
import { BadgeCheckIcon } from '@/components/ui/icons';

type Phase = 'details' | 'profile' | 'pending';

/**
 * Investor registration:
 *   1. Details — full name, NID, phone, password (the password is set here).
 *   2. Profile — the details create the Investor row
 *      (server-side; links by phone when the desk already registered them).
 */
export default function RegisterForm() {
  const t = useTranslations('register');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [phase, setPhase] = React.useState<Phase>('details');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [nid, setNid] = React.useState('');
  const [digits, setDigits] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  

  const phone = `+880${digits}`;

  const focusRing = 'focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (digits.length !== 10) {
      setError(t('errPhone'));
      return;
    }
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
      // Already registered? Tell the visitor what to do (log in vs. wait for
      // admin approval) before creating anything.
      const status = await checkRegistrationStatusAction(email.trim());
      if ('error' in status) {
        setError(tErrors('rateLimited'));
        return;
      }
      if (status.registered) {
        setError(status.approved ? t('errAlreadyApproved') : t('errAlreadyPending'));
        return;
      }
      if (isDemoClient()) {
        // Demo: create the account in-memory; approval is checked at login.
        const result = await demoSignUpAction({
          name: name.trim(),
          email: email.trim(),
          phone,
          password,
          nationalIdNumber: nid.trim() || null,
        });
        if (!result.ok) {
          setError(result.error === 'duplicateEmail' || result.error === 'duplicatePhone' ? t('errAlreadyRegistered') : t('errorGeneric'));
          return;
        }
        // Establish the demo session so the profile step has an identity.
        const login = await demoPasswordLoginAction(email.trim(), password);
        if (!login.ok) {
          setError(t('errorGeneric'));
          return;
        }
        setPhase('profile');
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim(), deposit_phone: phone, nid: nid.trim() } },
      });
      if (error) throw error;
      // Supabase returns no session when the email already exists (obfuscated
      // anti-enumeration response) or confirmation is pending — try signing in
      // with the just-entered password before giving up.
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setError(t('errSessionBlocked'));
          return;
        }
      }
      setPhase('profile');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      if (raw.includes('Unauthenticated')) {
        setError(t('errSessionBlocked'));
        return;
      }
      setError(raw.includes('already registered') ? t('errAlreadyRegistered') : raw || t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  

  const submitProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const result = await createInvestorProfileAction(
        { ok: false, fieldErrors: {} },
        formData,
      );
      if (!result.ok) {
        const first = Object.values(result.fieldErrors)[0]?.[0];
        setError(
          first ??
            (result.formError === 'noMatch'
              ? t('errNoMatch')
              : result.formError === 'unauthenticated'
                ? t('errSessionBlocked')
                : result.formError) ??
            t('errorGeneric'),
        );
        return;
      }
      setPhase('pending');
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const steps: Array<{ id: Phase; label: string }> = [
    { id: 'details', label: t('stepDetails') },
    { id: 'profile', label: t('stepProfile') },
  ];
  const stepIndex = phase === 'details' ? 0 : 1;

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 ? <span aria-hidden="true" className="h-px w-4 bg-line sm:w-6" /> : null}
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`hex-clip-pointy grid h-6 w-7 place-items-center font-mono text-[11px] font-semibold ${
                  i === stepIndex ? 'bg-honey text-ink' : i < stepIndex ? 'bg-honey-soft text-honey-deep' : 'bg-paper text-ink-soft border border-line'
                }`}
              >
                {i + 1}
              </span>
              <span className={`hidden text-xs font-medium sm:inline ${i === stepIndex ? 'text-ink' : 'text-ink-soft'}`}>{s.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-amber/40 bg-amber-soft/70 px-3.5 py-2.5 text-sm text-ink">
          {error}
        </div>
      ) : null}

      {phase === 'details' ? (
        <form onSubmit={submitDetails} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="reg-name" className="block text-sm font-medium text-ink">{t('nameLabel')}</label>
            <input
              id="reg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              autoComplete="name"
              required
              className={`nb-input ${focusRing}`}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-nid" className="block text-sm font-medium text-ink">{t('nidLabel')}</label>
            <input
              id="reg-nid"
              value={nid}
              onChange={(e) => setNid(e.target.value)}
              placeholder={t('nidPlaceholder')}
              autoComplete="off"
              required
              className={`nb-input font-mono ${focusRing}`}
            />
            <p className="text-xs text-ink-soft">{t('nidHelper')}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-phone" className="block text-sm font-medium text-ink">{t('phoneLabel')}</label>
            <div className="flex">
              <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-l-xl border border-r-0 border-line bg-paper px-3 font-mono text-sm text-ink-soft">+880</span>
              <input
                id="reg-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={digits}
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="1XXXXXXXXX"
                required
                className={`nb-input rounded-l-none font-mono ${focusRing}`}
              />
            </div>
            <p className="text-xs text-ink-soft">{t('codeHelper')}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="block text-sm font-medium text-ink">{t('emailLabel')}</label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              required
              className={`nb-input ${focusRing}`}
            />
            <p className="text-xs text-ink-soft">{t('emailHelper')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="reg-password" className="block text-sm font-medium text-ink">{t('passwordLabel')}</label>
              <input
                id="reg-password"
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
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-ink">{t('confirmPasswordLabel')}</label>
              <input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
                className={`nb-input ${focusRing}`}
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className={`${btnClasses('primary', 'lg')} w-full ${focusRing}`}>
            {loading ? t('submitting') : t('createAccount')}
          </button>
        </form>
      ) : null}

      {phase === 'profile' ? (
        <form onSubmit={submitProfile} className="space-y-4" noValidate>
          <div className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink-soft">
            {email.trim()}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-confirm-name" className="block text-sm font-medium text-ink">{t('nameLabel')}</label>
            <input
              id="reg-confirm-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={`nb-input ${focusRing}`}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-confirm-nid" className="block text-sm font-medium text-ink">{t('nidLabel')}</label>
            <input
              id="reg-confirm-nid"
              name="nationalIdNumber"
              value={nid}
              onChange={(e) => setNid(e.target.value)}
              required
              className={`nb-input font-mono ${focusRing}`}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-confirm-email" className="block text-sm font-medium text-ink">{t('emailLabel')}</label>
            <input
              id="reg-confirm-email"
              name="email"
              type="email"
              value={email.trim()}
              readOnly
              aria-readonly
              className={`nb-input bg-paper text-ink-soft ${focusRing}`}
            />
            <p className="text-xs text-ink-soft">{t('emailHelper')}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-confirm-phone" className="block text-sm font-medium text-ink">{t('depositPhoneLabel')}</label>
            <div className="flex">
              <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-l-xl border border-r-0 border-line bg-paper px-3 font-mono text-sm text-ink-soft">+880</span>
              <input
                id="reg-confirm-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                value={digits}
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
                className={`nb-input rounded-l-none font-mono ${focusRing}`}
              />
            </div>
            <p className="text-xs text-ink-soft">{t('depositPhoneHelper')}</p>
          </div>
          <button type="submit" disabled={loading} className={`${btnClasses('primary', 'lg')} w-full ${focusRing}`}>
            {loading ? t('submitting') : t('submitProfile')}
          </button>
        </form>
      ) : null}

      {phase === 'pending' ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto hex-clip-pointy grid h-12 w-13 place-items-center bg-honey-soft p-3 text-honey-deep">
            <BadgeCheckIcon size={22} />
          </div>
          <h2 className="font-display text-xl font-bold text-ink">{t('pendingTitle')}</h2>
          <p className="text-sm leading-relaxed text-ink-soft">{t('pendingBody')}</p>
          <button type="button" onClick={() => router.push('/')} className={`${btnClasses('outline', 'md')} w-full ${focusRing}`}>
            {t('pendingBackHome')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
