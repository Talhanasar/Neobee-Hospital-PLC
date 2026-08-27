'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { Money } from '@/components/ui/Money';
import {
  calculateAmount,
  calculateIncentive,
  deriveCategory,
  ENTREPRENEUR_MIN_SHARES,
  MAX_SHARES,
  MIN_SHARES,
} from '@/lib/money';
import { submitInvestmentRequestAction, type SubmitInvestmentRequestState } from '@/app/[locale]/(site)/portal/invest/actions';

const initialState: SubmitInvestmentRequestState = { ok: false, fieldErrors: {} };

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return <p id={id} className="mt-1 text-xs text-[#B3261E]">{messages[0]}</p>;
}

export default function InvestForm({ sharePrice, incentivePerShare }: { sharePrice: number; incentivePerShare: number }) {
  const t = useTranslations('invest');
  const tAdmin = useTranslations('admin');
  const tMethods = useTranslations('methods');
  const tFooter = useTranslations('footer');
  const [state, action, pending] = useActionState(submitInvestmentRequestAction, initialState);
  const [shares, setShares] = React.useState('');
  const [isEntrepreneurRequested, setIsEntrepreneurRequested] = React.useState(false);
  const shareCount = Number(shares);
  const canPreview = Number.isInteger(shareCount) && shares !== '';
  const category = canPreview && shareCount >= MIN_SHARES ? deriveCategory(shareCount) : null;
  const amount = canPreview ? calculateAmount(shareCount, sharePrice) : null;
  const incentive = canPreview && isEntrepreneurRequested ? calculateIncentive(shareCount, true, incentivePerShare) : null;
  const showEntrepreneurWarning = isEntrepreneurRequested && canPreview && shareCount < ENTREPRENEUR_MIN_SHARES;

  return (
    <form action={action} className="space-y-5">
      {state.ok ? (
        <div role="status" className="bg-green-soft text-green rounded-card px-4 py-3">
          {t('success', { requestId: state.requestId })}
          <Link href="/portal" className="ml-2 underline">{t('successPortal')}</Link>
        </div>
      ) : null}
      {state.ok === false && state.formError ? (
        <div role="alert" className="bg-[#FBE4E2] text-[#B3261E] rounded-card px-4 py-3">
          {state.formError === 'authRequired' ? t('errorAuth') : state.formError === 'openRequestCap' ? t('errorOpenCap') : state.formError === 'entrepreneurMinShares' ? t('errorEntrepreneur') : state.formError === 'sharesRange' ? t('errorSharesRange') : t('errorGeneric')}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="block text-[12.5px] font-semibold mb-1.5">{t('shares')}</span>
          <input
            name="shares"
            type="number"
            min={MIN_SHARES}
            max={MAX_SHARES}
            step={1}
            required
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            aria-invalid={Boolean(state.ok === false && state.fieldErrors.shares)}
            aria-describedby={state.ok === false && state.fieldErrors.shares ? 'shares-error' : undefined}
            className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
          />
          <FieldError id="shares-error" messages={state.ok === false ? state.fieldErrors.shares : undefined} />
        </label>
        <div className="block">
          <span className="block text-[12.5px] font-semibold mb-1.5">{t('category')}</span>
          <div className="px-3.5 py-2.5 border border-line rounded-lg bg-panel min-h-[44px] flex items-center">
            {category ? <CategoryBadge category={category} /> : <span className="text-ink-soft">—</span>}
          </div>
        </div>
        <label className="block">
          <span className="block text-[12.5px] font-semibold mb-1.5">{t('depositMethod')}</span>
          <select
            name="depositMethod"
            required
            aria-invalid={Boolean(state.ok === false && state.fieldErrors.depositMethod)}
            aria-describedby={state.ok === false && state.fieldErrors.depositMethod ? 'depositMethod-error' : undefined}
            className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
          >
            <option value="BANK_DEPOSIT">{tMethods('BANK_DEPOSIT')}</option>
            <option value="BANK_TRANSFER">{tMethods('BANK_TRANSFER')}</option>
            <option value="CHEQUE">{tMethods('CHEQUE')}</option>
            <option value="MOBILE_BANKING">{tMethods('MOBILE_BANKING')}</option>
          </select>
          <FieldError id="depositMethod-error" messages={state.ok === false ? state.fieldErrors.depositMethod : undefined} />
        </label>
        <label className="block">
          <span className="block text-[12.5px] font-semibold mb-1.5">{t('depositRef')}</span>
          <input
            name="depositRef"
            type="text"
            aria-invalid={Boolean(state.ok === false && state.fieldErrors.depositRef)}
            aria-describedby={state.ok === false && state.fieldErrors.depositRef ? 'depositRef-error' : undefined}
            className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
          />
          <FieldError id="depositRef-error" messages={state.ok === false ? state.fieldErrors.depositRef : undefined} />
        </label>
        <label className="block">
          <span className="block text-[12.5px] font-semibold mb-1.5">{t('depositDate')}</span>
          <input
            name="depositDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            aria-invalid={Boolean(state.ok === false && state.fieldErrors.depositDate)}
            aria-describedby={state.ok === false && state.fieldErrors.depositDate ? 'depositDate-error' : undefined}
            className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
          />
          <FieldError id="depositDate-error" messages={state.ok === false ? state.fieldErrors.depositDate : undefined} />
        </label>
        <label className="block md:col-span-2">
          <span className="block text-[12.5px] font-semibold mb-1.5">{t('note')}</span>
          <textarea
            name="note"
            rows={4}
            aria-invalid={Boolean(state.ok === false && state.fieldErrors.note)}
            aria-describedby={state.ok === false && state.fieldErrors.note ? 'note-error' : undefined}
            className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
          />
          <FieldError id="note-error" messages={state.ok === false ? state.fieldErrors.note : undefined} />
        </label>
      </div>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          name="entrepreneurRequested"
          checked={isEntrepreneurRequested}
          onChange={(e) => setIsEntrepreneurRequested(e.target.checked)}
          className="mt-1 h-[17px] w-[17px] accent-[var(--color-honey-deep)]"
        />
        <span className="text-sm">
          {t.rich('entrepreneurExplainer', { b: (chunks) => <b>{chunks}</b> })}
        </span>
      </label>
      {showEntrepreneurWarning ? <p className="text-xs text-[#B3261E]">{tAdmin('entrepreneurWarning')}</p> : null}

      <div className="bg-honey-soft border border-[#EFD9A4] rounded-[10px] px-4 py-3.5 text-[13.5px]">
        <div className="flex justify-between gap-3 py-[3px]">
          <span>
            {canPreview ? (
              <>
                {tAdmin('calcShares', { shares: shareCount.toLocaleString('en-IN') })} <Money value={sharePrice} />
              </>
            ) : (
              tAdmin('calcSharesEmpty')
            )}
          </span>
          <span>{amount == null ? '—' : <Money value={amount} />}</span>
        </div>
        {isEntrepreneurRequested ? (
          <div className="flex justify-between gap-3 py-[3px]">
            <span>
              {canPreview ? (
                <>
                  {tAdmin('calcIncentive', { shares: shareCount.toLocaleString('en-IN') })} <Money value={incentivePerShare} />
                </>
              ) : (
                tAdmin('calcSharesEmpty')
              )}
            </span>
            <span>{incentive == null ? '—' : <Money value={incentive} />}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 py-[3px] border-t border-dashed border-[#D9BE79] mt-1.5 pt-2 font-semibold">
          <span>{tAdmin('calcTotal')}</span>
          <span>{amount == null ? '—' : <Money value={amount} />}</span>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-panel p-4 text-sm">
        <p className="font-semibold">{t('depositNotice')}</p>
        <p className="mt-1 text-ink-soft">{tFooter('deposits')}</p>
      </div>

      {/* ponytail: ceiling is text/transfer details only; add slip upload via lib/storage.ts when a verified bucket is available. */}

      <Button variant="primary" type="submit" disabled={pending}>
        {pending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
