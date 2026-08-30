'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  updateInvestorProfileAction,
  type UpdateAccountState,
} from '@/app/[locale]/(dash)/portal/actions';
import { btnClasses } from '@/components/ui/bits';

const initialState: UpdateAccountState = { ok: false, fieldErrors: {} };

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return <p id={id} className="mt-1 text-xs font-medium text-amber">{messages[0]}</p>;
}

const labelCls = 'block text-sm font-medium text-ink';
const inputCls = 'nb-input focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';

export type AccountDetails = {
  name: string;
  phone: string;
  email: string | null;
  nationalIdNumber: string | null;
  memberSince: string;
};

/** Investor account details — identity fields are editable; the phone is
    the OTP-verified login identity and stays read-only. */
export default function AccountDetailsForm({ account }: { account: AccountDetails }) {
  const t = useTranslations('portal');
  const [state, action, pending] = useActionState(updateInvestorProfileAction, initialState);
  // Track the last-applied ok state so the success banner is derived during
  // render (no setState-in-effect): shows while this state is current, and
  // the next submit (new state object) clears it.
  const [seenOk, setSeenOk] = React.useState(false);
  if (state.ok !== seenOk) {
    setSeenOk(state.ok);
  }
  const saved = state.ok;

  const fieldErrors = state.ok === false ? state.fieldErrors : {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {saved ? (
        <div role="status" className="rounded-xl border border-green/30 bg-green-soft/60 px-3.5 py-2.5 text-sm text-green">
          {t('accountSaved')}
        </div>
      ) : null}
      {state.ok === false && state.formError ? (
        <div role="alert" className="rounded-xl border border-amber/40 bg-amber-soft/70 px-3.5 py-2.5 text-sm text-ink">
          {state.formError === 'authRequired' ? t('errorAuth') : state.formError === 'pendingApproval' ? t('pendingBody') : t('errorGeneric')}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="account-phone" className={labelCls}>{t('phoneVerified')}</label>
        <input
          id="account-phone"
          type="tel"
          value={account.phone}
          readOnly
          aria-readonly
          className={`${inputCls} font-mono bg-paper text-ink-soft`}
        />
        <p className="text-xs text-ink-soft">{t('phoneReadonly')}</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="account-name" className={labelCls}>{t('nameLabel')}</label>
        <input
          id="account-name"
          name="name"
          defaultValue={account.name}
          required
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? 'account-name-error' : undefined}
          className={inputCls}
        />
        <FieldError id="account-name-error" messages={fieldErrors.name} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="account-nid" className={labelCls}>{t('nidLabel')}</label>
        <input
          id="account-nid"
          name="nationalIdNumber"
          defaultValue={account.nationalIdNumber ?? ''}
          required
          aria-invalid={Boolean(fieldErrors.nationalIdNumber)}
          aria-describedby={fieldErrors.nationalIdNumber ? 'account-nid-error' : undefined}
          className={`${inputCls} font-mono`}
        />
        <FieldError id="account-nid-error" messages={fieldErrors.nationalIdNumber} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="account-email" className={labelCls}>{t('emailLabel')}</label>
        <input
          id="account-email"
          name="email"
          type="email"
          defaultValue={account.email ?? ''}
          placeholder={t('emailPlaceholder')}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'account-email-error' : undefined}
          className={inputCls}
        />
        <FieldError id="account-email-error" messages={fieldErrors.email} />
      </div>

      <p className="text-xs text-ink-soft">{t('memberSince', { date: account.memberSince })}</p>

      <button type="submit" disabled={pending} className={`${btnClasses('primary', 'md')} focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2`}>
        {pending ? t('accountSaving') : t('accountSave')}
      </button>
    </form>
  );
}
