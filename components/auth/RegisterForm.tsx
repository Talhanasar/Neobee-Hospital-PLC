'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkRegistrationStatusAction } from '@/app/[locale]/(auth)/login/actions';
import { investorSignupAction, type InvestorSignupState } from '@/app/[locale]/(auth)/register/actions';
import { isDemoClient } from '@/data/demo/client';
import { btnClasses } from '@/components/ui/bits';
import { BadgeCheckIcon } from '@/components/ui/icons';
import {
  canPayByInstallment,
  deriveCategory,
  formatBdt,
  installmentPerKisti,
  MAX_SHARES,
  MIN_SHARES,
} from '@/lib/money';
import { CategoryBadge } from '@/components/ui/CategoryBadge';

type Phase = 'details' | 'investment' | 'deposit' | 'otp' | 'success';

const SHARE_PRICE = 200000; // display only; the server recomputes from live settings
const KISTI_UNIT = 50000;

/**
 * Investor registration wizard:
 *   1. Details — name, phone, email, password, NID, address.
 *   2. Investment — shares + payment plan (locked amounts, discount note).
 *   3. Deposit — method, date, reference, slip image upload.
 *   4. OTP — 6-digit code sent to the email; verifyOtp creates the session.
 * Then the server action files the Investor row + share request; the admin
 * queue takes it from there.
 */
export default function RegisterForm() {
  const t = useTranslations('register');
  const tInv = useTranslations('invest');
  const tErrors = useTranslations('errors');
  const tMethods = useTranslations('methods');
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [wizardPhase, setPhase] = React.useState<Phase>('details');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [otp, setOtp] = React.useState('');
  const [otpSent, setOtpSent] = React.useState(false);

  const [name, setName] = React.useState('');
  const [nid, setNid] = React.useState('');
  const [digits, setDigits] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const [shares, setShares] = React.useState(1);
  const [paymentPlan, setPaymentPlan] = React.useState<'FULL' | 'INSTALLMENT'>('FULL');

  const [depositMethod, setDepositMethod] = React.useState('BANK_DEPOSIT');
  const [depositRef, setDepositRef] = React.useState('');
  const [depositDate, setDepositDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = React.useState('');
  const [slipFile, setSlipFile] = React.useState<File | null>(null);

  const phone = `+880${digits}`;
  const focusRing = 'focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';

  const amountDue = paymentPlan === 'FULL' ? SHARE_PRICE * shares : installmentPerKisti(shares, KISTI_UNIT);
  const kistiAllowed = canPayByInstallment(shares);

  const [signupState, signupAction, signupPending] = useActionState(investorSignupAction, {
    ok: false,
    fieldErrors: {},
  } satisfies InvestorSignupState);

  // Phase follows the action result; no setState-in-effect cascade.
  const phase: Phase = signupState.ok ? 'success' : wizardPhase;

  // ── Phase 1: account details ─────────────────────────────────────────
  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (digits.length !== 10) { setError(t('errPhone')); return; }
    if (password.length < 6) { setError(t('errPasswordShort')); return; }
    if (password !== confirmPassword) { setError(t('errPasswordMismatch')); return; }
    setLoading(true);
    try {
      const status = await checkRegistrationStatusAction(email.trim());
      if ('error' in status) { setError(tErrors('rateLimited')); return; }
      if (status.registered) {
        setError(status.approved ? t('errAlreadyApproved') : t('errAlreadyPending'));
        return;
      }
      // Create the auth user now; email confirmation is enforced via the OTP step.
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim(), deposit_phone: phone, nid: nid.trim() } },
      });
      if (signUpError) {
        setError(signUpError.message.includes('already registered') ? t('errAlreadyRegistered') : signUpError.message);
        return;
      }
      setPhase('investment');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      setError(raw || t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  // ── Phase 4: email OTP ───────────────────────────────────────────────
  const sendOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      // Demo: no email gateway — skip the OTP send; the code step accepts any 6 digits.
      if (isDemoClient()) {
        setOtpSent(true);
        return;
      }
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (otpError) throw otpError;
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || signupPending) return;
    setError(null);
    if (otp.trim().length !== 6) { setError(t('errOtpLength')); return; }
    setLoading(true);
    try {
      // Demo: no email gateway — any 6-digit code verifies; skip the OTP check
      // and proceed straight to the signup action.
      if (!isDemoClient()) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otp.trim(),
          type: 'email',
        });
        if (verifyError) { setError(t('errOtpWrong')); return; }
      }
      // Session established — the form action carries the whole wizard payload.
      const formData = new FormData();
      formData.set('name', name.trim());
      formData.set('phone', phone);
      formData.set('email', email.trim());
      if (address.trim()) formData.set('address', address.trim());
      formData.set('nationalIdNumber', nid.trim());
      formData.set('password', password);
      formData.set('shares', String(shares));
      formData.set('paymentPlan', paymentPlan);
      formData.set('depositMethod', depositMethod);
      if (depositRef.trim()) formData.set('depositRef', depositRef.trim());
      formData.set('depositDate', depositDate);
      if (note.trim()) formData.set('note', note.trim());
      if (slipFile) formData.set('slipFile', slipFile);
      // React's action dispatch from an event handler:
      signupAction(formData);
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const steps: Array<{ id: Phase; label: string }> = [
    { id: 'details', label: t('stepDetails') },
    { id: 'investment', label: t('stepInvestment') },
    { id: 'deposit', label: t('stepDeposit') },
    { id: 'otp', label: t('stepOtp') },
  ];
  const stepIndex = Math.min(steps.findIndex((s) => s.id === phase), steps.length - 1);

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
            <input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} autoComplete="name" required className={`nb-input ${focusRing}`} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-nid" className="block text-sm font-medium text-ink">{t('nidLabel')}</label>
            <input id="reg-nid" value={nid} onChange={(e) => setNid(e.target.value)} placeholder={t('nidPlaceholder')} autoComplete="off" required className={`nb-input font-mono ${focusRing}`} />
            <p className="text-xs text-ink-soft">{t('nidHelper')}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-phone" className="block text-sm font-medium text-ink">{t('phoneLabel')}</label>
            <div className="flex">
              <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-l-xl border border-r-0 border-line bg-paper px-3 font-mono text-sm text-ink-soft">+880</span>
              <input id="reg-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={digits} onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="1XXXXXXXXX" required className={`nb-input rounded-l-none font-mono ${focusRing}`} />
            </div>
            <p className="text-xs text-ink-soft">{t('codeHelper')}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="block text-sm font-medium text-ink">{t('emailLabel')}</label>
            <input id="reg-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} required className={`nb-input ${focusRing}`} />
            <p className="text-xs text-ink-soft">{t('emailHelper')}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-address" className="block text-sm font-medium text-ink">{t('addressLabel')}</label>
            <input id="reg-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('addressPlaceholder')} autoComplete="street-address" className={`nb-input ${focusRing}`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="reg-password" className="block text-sm font-medium text-ink">{t('passwordLabel')}</label>
              <input id="reg-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required className={`nb-input ${focusRing}`} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-ink">{t('confirmPasswordLabel')}</label>
              <input id="reg-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required className={`nb-input ${focusRing}`} />
            </div>
          </div>
          <button type="submit" disabled={loading} className={`${btnClasses('primary', 'lg')} w-full ${focusRing}`}>
            {loading ? t('submitting') : t('nextStep')}
          </button>
        </form>
      ) : null}

      {phase === 'investment' ? (
        <form
          onSubmit={(e) => { e.preventDefault(); setPhase('deposit'); }}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <label htmlFor="reg-shares" className="block text-sm font-medium text-ink">{tInv('shares')}</label>
            <input
              id="reg-shares"
              type="number"
              min={MIN_SHARES}
              max={MAX_SHARES}
              value={shares}
              onChange={(e) => {
                const n = Math.max(MIN_SHARES, Math.min(MAX_SHARES, Number(e.target.value) || MIN_SHARES));
                setShares(n);
                if (!canPayByInstallment(n)) setPaymentPlan('FULL');
              }}
              required
              className={`nb-input font-mono ${focusRing}`}
            />
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-ink-soft">{tInv('category')}</span>
              <CategoryBadge category={deriveCategory(shares)} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="block text-sm font-medium text-ink">{t('planLabel')}</legend>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 ${paymentPlan === 'FULL' ? 'border-honey bg-honey-soft/40' : 'border-line bg-paper'}`}>
              <input type="radio" name="paymentPlan" value="FULL" checked={paymentPlan === 'FULL'} onChange={() => setPaymentPlan('FULL')} className="mt-1" />
              <span>
                <span className="block text-sm font-semibold text-ink">{t('planFull')}</span>
                <span className="block text-xs text-ink-soft">{t('planFullHint')}</span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 ${!kistiAllowed ? 'cursor-not-allowed opacity-50' : paymentPlan === 'INSTALLMENT' ? 'border-honey bg-honey-soft/40' : 'border-line bg-paper'}`}>
              <input type="radio" name="paymentPlan" value="INSTALLMENT" disabled={!kistiAllowed} checked={paymentPlan === 'INSTALLMENT'} onChange={() => setPaymentPlan('INSTALLMENT')} className="mt-1" />
              <span>
                <span className="block text-sm font-semibold text-ink">{t('planKisti')}</span>
                <span className="block text-xs text-ink-soft">{kistiAllowed ? t('planKistiHint') : t('planKistiOneShareOnly')}</span>
              </span>
            </label>
          </fieldset>

          <div className="rounded-xl border border-line bg-paper px-3.5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-ink">{t('amountPaidLabel')}</span>
              <span className="num font-display text-lg font-bold text-ink">৳{formatBdt(amountDue)}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
              {paymentPlan === 'FULL'
                ? t('fullDiscountNote')
                : t('kistiAmountNote', { unit: formatBdt(KISTI_UNIT) })}
            </p>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setPhase('details')} className={`${btnClasses('outline', 'lg')} ${focusRing}`}>{t('backStep')}</button>
            <button type="submit" className={`${btnClasses('primary', 'lg')} flex-1 ${focusRing}`}>{t('nextStep')}</button>
          </div>
        </form>
      ) : null}

      {phase === 'deposit' ? (
        <form onSubmit={(e) => { e.preventDefault(); setPhase('otp'); }} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="reg-method" className="block text-sm font-medium text-ink">{tInv('depositMethod')}</label>
            <select id="reg-method" value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)} className={`nb-input ${focusRing}`}>
              <option value="BANK_DEPOSIT">{tMethods('BANK_DEPOSIT')}</option>
              <option value="BANK_TRANSFER">{tMethods('BANK_TRANSFER')}</option>
              <option value="CHEQUE">{tMethods('CHEQUE')}</option>
              <option value="MOBILE_BANKING">{tMethods('MOBILE_BANKING')}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-deposit-date" className="block text-sm font-medium text-ink">{tInv('depositDate')}</label>
            <input id="reg-deposit-date" type="date" value={depositDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDepositDate(e.target.value)} required className={`nb-input font-mono ${focusRing}`} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-deposit-ref" className="block text-sm font-medium text-ink">{tInv('depositRef')}</label>
            <input id="reg-deposit-ref" value={depositRef} onChange={(e) => setDepositRef(e.target.value)} placeholder={t('depositRefPlaceholder')} className={`nb-input font-mono ${focusRing}`} />
            <p className="text-xs text-ink-soft">{t('depositRefHelper')}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-slip" className="block text-sm font-medium text-ink">{t('slipLabel')}</label>
            <input
              id="reg-slip"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)}
              required
              className={`nb-input file:mr-3 file:rounded-md file:border-0 file:bg-honey-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-honey-deep ${focusRing}`}
            />
            <p className="text-xs text-ink-soft">{t('slipHelper', { max: '5 MB' })}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-note" className="block text-sm font-medium text-ink">{tInv('note')}</label>
            <textarea id="reg-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={`nb-input ${focusRing}`} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPhase('investment')} className={`${btnClasses('outline', 'lg')} ${focusRing}`}>{t('backStep')}</button>
            <button type="submit" disabled={!slipFile} className={`${btnClasses('primary', 'lg')} flex-1 ${focusRing}`}>
              {loading ? t('submitting') : t('nextStep')}
            </button>
          </div>
        </form>
      ) : null}

      {phase === 'otp' ? (
        <form onSubmit={verifyOtpAndSubmit} className="space-y-4" noValidate>
          <p className="text-sm leading-relaxed text-ink-soft">{otpSent ? t('otpSentBody', { email: email.trim() }) : t('otpBody')}</p>
          <div className="space-y-1.5">
            <label htmlFor="reg-otp" className="block text-sm font-medium text-ink">{t('otpLabel')}</label>
            <input
              id="reg-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              className={`nb-input text-center font-mono text-lg tracking-[0.5em] ${focusRing}`}
            />
          </div>
          <button type="submit" disabled={loading || signupPending} className={`${btnClasses('primary', 'lg')} w-full ${focusRing}`}>
            {loading || signupPending ? t('submitting') : t('otpConfirm')}
          </button>
          <button type="button" onClick={sendOtp} disabled={loading} className={`${btnClasses('ghost', 'md')} w-full ${focusRing}`}>
            {otpSent ? t('otpResend') : t('otpSend')}
          </button>
          <button type="button" onClick={() => setPhase('deposit')} className={`${btnClasses('ghost', 'md')} w-full ${focusRing}`}>{t('backStep')}</button>
        </form>
      ) : null}

      {phase === 'success' ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto hex-clip-pointy grid h-12 w-13 place-items-center bg-honey-soft p-3 text-honey-deep">
            <BadgeCheckIcon size={22} />
          </div>
          <h2 className="font-display text-xl font-bold text-ink">{t('successTitle')}</h2>
          <p className="text-sm leading-relaxed text-ink-soft">{t('successBody')}</p>
          <button type="button" onClick={() => router.push('/portal')} className={`${btnClasses('primary', 'lg')} w-full ${focusRing}`}>
            {t('successToPortal')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
