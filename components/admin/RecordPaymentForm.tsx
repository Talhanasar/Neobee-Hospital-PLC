'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  recordPaymentAction,
  type RecordPaymentState,
} from '@/app/[locale]/(dash)/admin/receipts/[id]/actions';
import { Button } from '@/components/ui/Button';
import { BadgeCheckIcon } from '@/components/ui/icons';

const initialState: RecordPaymentState = { ok: false, fieldErrors: {} };

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return <p id={id} className="mt-1 text-xs text-[#B3261E]">{messages[0]}</p>;
}

const labelCls = 'block text-[12.5px] font-semibold mb-1.5';
const inputCls = 'w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel text-sm focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';

/** Staff form: record a payment an investor reported by phone against this
    investment. Writes a DEPOSIT ledger transaction (audited). */
export function RecordPaymentForm({ investmentId }: { investmentId: string }) {
  const t = useTranslations('admin');
  const tMethods = useTranslations('methods');
  const [state, action, pending] = useActionState(
    recordPaymentAction.bind(null, investmentId),
    initialState,
  );

  const inputRef = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (state.ok) inputRef.current?.reset();
  }, [state]);

  return (
    <form ref={inputRef} action={action} className="space-y-3">
      {state.ok ? (
        <div role="status" className="rounded-lg bg-green-soft px-3 py-2 text-sm font-semibold text-green flex items-center gap-1.5">
          <BadgeCheckIcon size={15} aria-hidden="true" />
          {t('paymentRecorded')}
        </div>
      ) : null}
      {state.ok === false && state.formError ? (
        <div role="alert" className="rounded-lg bg-[#FBE4E2] px-3 py-2 text-sm text-[#B3261E]">{state.formError}</div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>{t('paymentAmount')}</span>
          <input name="amount" type="number" min={1} step={1} required className={`${inputCls} num`} />
          <FieldError id="rp-amount" messages={state.ok === false ? state.fieldErrors.amount : undefined} />
        </label>
        <label className="block">
          <span className={labelCls}>{t('colDepositMethod')}</span>
          <select name="depositMethod" required className={inputCls}>
            <option value="BANK_DEPOSIT">{tMethods('BANK_DEPOSIT')}</option>
            <option value="BANK_TRANSFER">{tMethods('BANK_TRANSFER')}</option>
            <option value="CHEQUE">{tMethods('CHEQUE')}</option>
            <option value="MOBILE_BANKING">{tMethods('MOBILE_BANKING')}</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>{t('colDepositDate')}</span>
          <input name="depositDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t('colDepositRefLabel')}</span>
          <input name="depositRef" type="text" className={inputCls} />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelCls}>{t('paymentRecordNote')}</span>
          <input name="note" type="text" className={inputCls} />
        </label>
      </div>
      <Button variant="primary" type="submit" disabled={pending}>
        {pending ? t('paymentRecording') : t('paymentRecordSubmit')}
      </Button>
    </form>
  );
}
