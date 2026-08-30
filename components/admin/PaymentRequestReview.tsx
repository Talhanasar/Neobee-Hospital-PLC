'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  approvePaymentRequestAction,
  rejectRequestAction,
  type ReviewState,
} from '@/app/[locale]/(dash)/admin/requests/actions';
import { Button } from '@/components/ui/Button';

const initialState: ReviewState = { ok: false, fieldErrors: {} };

/** Approve / reject UI for PAYMENT-kind requests. Approval records the
    DEPOSIT ledger transaction — there are no editable subscription fields. */
export function PaymentRequestReview({ requestId }: { requestId: string }) {
  const t = useTranslations('admin');
  const [approveState, approveAction, approvePending] = useActionState(
    approvePaymentRequestAction.bind(null, requestId),
    initialState,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectRequestAction.bind(null, requestId),
    initialState,
  );

  const focusRing = 'focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';

  if (approveState.ok || rejectState.ok) {
    return (
      <div role="status" className="bg-green-soft text-green rounded-card px-4 py-3 text-sm font-semibold">
        {approveState.ok ? t('approveSuccessNoInvestment') : t('rejectSuccess')}
      </div>
    );
  }

  const error = approveState.ok === false && approveState.formError
    ? approveState.formError
    : rejectState.ok === false && rejectState.formError
      ? rejectState.formError
      : null;

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="bg-[#FBE4E2] text-[#B3261E] rounded-card px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <form action={approveAction} className="bg-panel border border-line rounded-card p-4 space-y-3">
        <label className="block">
          <span className="block text-[12.5px] font-semibold mb-1.5">{t('reviewNoteOptional')}</span>
          <textarea
            name="reviewNote"
            rows={2}
            className={`w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel text-sm ${focusRing}`}
          />
          <p className="mt-1 text-xs text-ink-soft">{t('paymentApproveHint')}</p>
        </label>
        <Button variant="primary" type="submit" disabled={approvePending}>
          {approvePending ? t('approvePending') : t('approveSubmit')}
        </Button>
      </form>

      <form action={rejectAction} className="bg-panel border border-line rounded-card p-4 space-y-3">
        <label className="block">
          <span className="block text-[12.5px] font-semibold mb-1.5">{t('reviewNoteRequired')}</span>
          <textarea
            name="reviewNote"
            rows={2}
            required
            className={`w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel text-sm ${focusRing}`}
          />
          <p className="mt-1 text-xs text-ink-soft">{t('rejectNoteHint')}</p>
        </label>
        <Button variant="default" type="submit" disabled={rejectPending}>
          {rejectPending ? t('rejectPending') : t('rejectSubmit')}
        </Button>
      </form>
    </div>
  );
}
