'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { submitLeadAction, type SubmitLeadState } from '@/app/[locale]/(site)/interest/actions';
import { Btn, Field, HexOutline, Kicker, btnClasses } from '@/components/ui/bits';
import {
  BadgeCheckIcon,
  CopyIcon,
  CopyXIcon,
  HandshakeIcon,
  InfoIcon,
  SendIcon,
} from '@/components/ui/icons';

const initialState: SubmitLeadState = { ok: false, fieldErrors: {} };

/**
 * Public interest / lead-capture form — the recommended public entry
 * point for "Become a Shareholder": nothing here touches the staff-only
 * deposit register. Server action validates, soft-warns duplicates and
 * mints the NB-LEAD-XXXX reference.
 */
export default function LeadForm() {
  const t = useTranslations('interest');
  const tErrors = useTranslations('errors');
  const [state, formAction, pending] = useActionState(submitLeadAction, initialState);

  /* Reference chip shown on the success panel, with copy feedback. */
  const [copied, setCopied] = React.useState(false);
  const copyRef = async () => {
    if (state.ok !== true) return;
    try {
      await navigator.clipboard.writeText(state.ref);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (state.ok) {
    return (
      <div className="nb-card p-6 sm:p-8">
        <div className="py-6 text-center" role="status">
          <div aria-hidden="true" className="hex-clip-pointy mx-auto grid h-16 w-[72px] place-items-center bg-green-soft">
            <BadgeCheckIcon size={26} className="text-green" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold text-ink">{t('success')}</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">{t('successBody')}</p>
          <div className="mx-auto mt-5 flex max-w-xs items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3.5 py-2.5">
            <span className="min-w-0">
              <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">{t('refLabel')}</span>
              <span className="num block text-sm font-bold text-ink">{state.ref}</span>
            </span>
            <button
              type="button"
              onClick={copyRef}
              aria-label={t('refCopied')}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-panel text-ink-soft transition-colors hover:border-honey hover:text-honey-deep focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
            >
              {copied ? <BadgeCheckIcon size={14} aria-hidden="true" /> : <CopyIcon size={14} aria-hidden="true" />}
            </button>
          </div>
          <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link href="/login" className={btnClasses('primary', 'lg')}>{t('ctaLogin')}</Link>
            <Link href="/" className={btnClasses('outline', 'lg')}>{t('ctaHome')}</Link>
          </div>
        </div>
      </div>
    );
  }

  const isFieldState = state.ok === false && !('duplicate' in state);
  const nameError = isFieldState && state.fieldErrors.name ? t('errName') : undefined;
  const phoneError = isFieldState && state.fieldErrors.phone ? t('errPhone') : undefined;

  return (
    <div className="relative mx-auto max-w-xl">
      <HexOutline
        strokeWidth={2}
        className="pointer-events-none absolute -right-10 -top-10 hidden h-28 w-28 text-honey/30 sm:block"
      />
      <div className="nb-card p-6 sm:p-8">
        <Kicker>{t('kicker')}</Kicker>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">{t('h1')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t('body')}</p>

        <form action={formAction} className="mt-6 space-y-5" noValidate>
          <Field label={t('name')} htmlFor="lead-name" error={nameError}>
            <input
              id="lead-name"
              name="name"
              className="nb-input"
              placeholder={t('namePh')}
              autoComplete="name"
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('phone')} htmlFor="lead-phone" error={phoneError}>
              <input
                id="lead-phone"
                name="phone"
                className="nb-input font-mono tnum"
                placeholder="01XXXXXXXXX"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={11}
                pattern="[0-9]*"
              />
            </Field>
            <Field label={t('email')} htmlFor="lead-email">
              <input
                id="lead-email"
                name="email"
                type="email"
                className="nb-input"
                placeholder={t('emailPh')}
                autoComplete="email"
              />
            </Field>
          </div>
          <Field label={t('message')} htmlFor="lead-message">
            <textarea id="lead-message" name="message" className="nb-input min-h-24 py-3" placeholder={t('messagePh')} />
          </Field>

          {state.ok === false && 'duplicate' in state && state.duplicate ? (
            <div role="alert" className="rounded-xl border border-amber/40 bg-amber-soft/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <CopyXIcon size={15} className="text-amber" aria-hidden="true" />
                {t('dupTitle')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                {t('dupBody').replace('{date}', fmtDate(state.duplicateOf))}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn
                  type="submit"
                  variant="outline"
                  size="sm"
                  name="force"
                  value="1"
                  className="focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
                >
                  {t('dupSend')}
                </Btn>
              </div>
            </div>
          ) : null}

          {isFieldState && state.formError ? (
            <div role="alert" className="rounded-xl border border-amber/40 bg-amber-soft/70 p-4 text-sm text-ink">
              {state.formError === 'rateLimited' ? tErrors('rateLimited') : t('errorGeneric')}
            </div>
          ) : null}

          <Btn type="submit" size="lg" className="w-full focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2" disabled={pending}>
            <SendIcon size={16} aria-hidden="true" />
            {pending ? t('submitting') : t('submit')}
          </Btn>
          <p className="flex items-center gap-2 text-xs text-ink-soft">
            <InfoIcon size={13} className="shrink-0 text-honey-deep" aria-hidden="true" />
            {t('privacy')}
          </p>
        </form>
      </div>

      <div className="mx-auto mt-8">
        <div className="nb-card p-6">
          <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-honey-deep">
            <HandshakeIcon size={15} aria-hidden="true" />
            {t('steps')}
          </p>
          <ol className="mt-4 space-y-3">
            {[t('step1'), t('step2'), t('step3')].map((s, i) => (
              <li key={s} className="flex items-start gap-3 text-sm text-ink-soft">
                <span
                  aria-hidden="true"
                  className="hex-clip-pointy mt-0.5 grid h-6 w-[26px] shrink-0 place-items-center bg-honey-soft font-mono text-[11px] font-semibold text-honey-deep"
                >
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
