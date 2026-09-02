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
  type InvestmentCategory,
} from '@/lib/money';
import { submitInvestmentRequestAction, type SubmitInvestmentRequestState } from '@/app/[locale]/(dash)/portal/invest/actions';

const initialState: SubmitInvestmentRequestState = { ok: false, fieldErrors: {} };

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return <p id={id} className="mt-1 text-xs text-[#B3261E]">{messages[0]}</p>;
}

export type PortalInvestmentOption = {
  id: string;
  uid: string;
  category: InvestmentCategory;
  shares: number;
  status: 'PENDING' | 'CONFIRMED';
  paymentPlan: 'FULL' | 'INSTALLMENT';
};

export type PortalKistiOption = {
  investmentId: string;
  installmentNo: number;
  amount: number;
  dueDate: string; // ISO date
  status: 'SCHEDULED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
};

const focusRing = 'focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';
const labelCls = 'block text-[12.5px] font-semibold mb-1.5';
const inputCls = `w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel ${focusRing}`;

export default function InvestForm({
  sharePrice,
  incentivePerShare,
  investments,
  installments = [],
}: {
  sharePrice: number;
  incentivePerShare: number;
  investments: PortalInvestmentOption[];
  installments?: PortalKistiOption[];
}) {
  const t = useTranslations('invest');
  const tReg = useTranslations('register');
  const tAdmin = useTranslations('admin');
  const tMethods = useTranslations('methods');
  const tFooter = useTranslations('footer');
  const [state, action, pending] = useActionState(submitInvestmentRequestAction, initialState);
  const [kind, setKind] = React.useState<'share' | 'payment'>('share');
  const [shares, setShares] = React.useState('');
  const [isEntrepreneurRequested, setIsEntrepreneurRequested] = React.useState(false);
  const [targetInvestmentId, setTargetInvestmentId] = React.useState('');
  const [paymentAmount, setPaymentAmount] = React.useState('');
  const [installmentNo, setInstallmentNo] = React.useState('');
  const shareCount = Number(shares);
  const canPreview = Number.isInteger(shareCount) && shares !== '';
  const category = canPreview && shareCount >= MIN_SHARES ? deriveCategory(shareCount) : null;
  const amount = canPreview ? calculateAmount(shareCount, sharePrice) : null;
  const incentive = canPreview && isEntrepreneurRequested ? calculateIncentive(shareCount, true, incentivePerShare) : null;
  const showEntrepreneurWarning = isEntrepreneurRequested && canPreview && shareCount < ENTREPRENEUR_MIN_SHARES;

  // Unpaid kistis for the currently selected investment (kisti payment flow).
  const openKistis = installments.filter(
    (k) => k.investmentId === targetInvestmentId && (k.status === 'SCHEDULED' || k.status === 'OVERDUE'),
  );
  const selectedKisti = openKistis.find((k) => String(k.installmentNo) === installmentNo) ?? null;

  const fieldErrors = state.ok === false ? state.fieldErrors : {};
  const firstFieldError = (key: string) => fieldErrors[key];

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
          {state.formError === 'authRequired' ? t('errorAuth') : state.formError === 'pendingApproval' ? t('pendingBody') : state.formError === 'openRequestCap' ? t('errorOpenCap') : state.formError === 'entrepreneurMinShares' ? t('errorEntrepreneur') : state.formError === 'sharesRange' ? t('errorSharesRange') : state.formError === 'targetInvestment' ? t('errorChooseInvestment') : state.formError === 'amountInvalid' ? t('errorAmount') : t('errorGeneric')}
        </div>
      ) : null}

      {/* Payment-kind toggle */}
      <input type="hidden" name="kind" value={kind} />
      <div role="group" aria-label={t('kindLabel')} className="inline-flex items-center rounded-full border border-line bg-paper p-1">
        {(['share', 'payment'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${focusRing} ${
              kind === k ? 'bg-honey text-ink' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {k === 'share' ? t('kindShare') : t('kindPayment')}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-sm text-ink-soft">{kind === 'share' ? t('kindShareHint') : t('kindPaymentHint')}</p>

      {kind === 'share' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className={labelCls}>{t('shares')}</span>
              <input
                name="shares"
                type="number"
                min={MIN_SHARES}
                max={MAX_SHARES}
                step={1}
                required
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                aria-invalid={Boolean(firstFieldError('shares'))}
                aria-describedby={firstFieldError('shares') ? 'shares-error' : undefined}
                className={inputCls}
              />
              <FieldError id="shares-error" messages={firstFieldError('shares')} />
            </label>
            <div className="block">
              <span className={labelCls}>{t('category')}</span>
              <div className="px-3.5 py-2.5 border border-line rounded-lg bg-panel min-h-[44px] flex items-center">
                {category ? <CategoryBadge category={category} /> : <span className="text-ink-soft">—</span>}
              </div>
            </div>
            <label className="block">
              <span className={labelCls}>{t('depositMethod')}</span>
              <select
                name="depositMethod"
                required
                aria-invalid={Boolean(firstFieldError('depositMethod'))}
                aria-describedby={firstFieldError('depositMethod') ? 'depositMethod-error' : undefined}
                className={inputCls}
              >
                <option value="BANK_DEPOSIT">{tMethods('BANK_DEPOSIT')}</option>
                <option value="BANK_TRANSFER">{tMethods('BANK_TRANSFER')}</option>
                <option value="CHEQUE">{tMethods('CHEQUE')}</option>
                <option value="MOBILE_BANKING">{tMethods('MOBILE_BANKING')}</option>
              </select>
              <FieldError id="depositMethod-error" messages={firstFieldError('depositMethod')} />
            </label>
            <label className="block">
              <span className={labelCls}>{t('depositRef')}</span>
              <input
                name="depositRef"
                type="text"
                aria-invalid={Boolean(firstFieldError('depositRef'))}
                aria-describedby={firstFieldError('depositRef') ? 'depositRef-error' : undefined}
                className={inputCls}
              />
              <FieldError id="depositRef-error" messages={firstFieldError('depositRef')} />
            </label>
            <label className="block">
              <span className={labelCls}>{t('depositDate')}</span>
              <input
                name="depositDate"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                aria-invalid={Boolean(firstFieldError('depositDate'))}
                aria-describedby={firstFieldError('depositDate') ? 'depositDate-error' : undefined}
                className={inputCls}
              />
              <FieldError id="depositDate-error" messages={firstFieldError('depositDate')} />
            </label>
            <label className="block md:col-span-2">
              <span className={labelCls}>{t('note')}</span>
              <textarea
                name="note"
                rows={4}
                aria-invalid={Boolean(firstFieldError('note'))}
                aria-describedby={firstFieldError('note') ? 'note-error' : undefined}
                className={inputCls}
              />
              <FieldError id="note-error" messages={firstFieldError('note')} />
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
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className={labelCls}>{t('chooseInvestment')}</span>
              <select
                name="targetInvestmentId"
                required
                value={targetInvestmentId}
                onChange={(e) => setTargetInvestmentId(e.target.value)}
                aria-invalid={Boolean(firstFieldError('targetInvestmentId'))}
                aria-describedby={firstFieldError('targetInvestmentId') ? 'targetInvestmentId-error' : undefined}
                className={inputCls}
              >
                <option value="">{t('chooseInvestmentPlaceholder')}</option>
                {investments.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {`${inv.uid} · ${inv.shares.toLocaleString('en-IN')} ${t('shares')} · ${inv.status === 'CONFIRMED' ? t('statusConfirmed') : t('statusPending')}`}
                  </option>
                ))}
              </select>
              <FieldError id="targetInvestmentId-error" messages={firstFieldError('targetInvestmentId')} />
            </label>
            {openKistis.length > 0 ? (
              <label className="block">
                <span className={labelCls}>{t('chooseKisti')}</span>
                <select
                  name="installmentNo"
                  value={installmentNo}
                  onChange={(e) => {
                    setInstallmentNo(e.target.value);
                    const k = openKistis.find((row) => String(row.installmentNo) === e.target.value);
                    if (k) setPaymentAmount(String(k.amount));
                  }}
                  className={inputCls}
                >
                  <option value="">{t('chooseKistiPlaceholder')}</option>
                  {openKistis.map((k) => (
                    <option key={k.installmentNo} value={k.installmentNo}>
                      {`${t('kistiLabel', { no: k.installmentNo })} · ৳${k.amount.toLocaleString('en-IN')} · ${k.dueDate.slice(0, 10)}`}
                    </option>
                  ))}
                </select>
                {selectedKisti ? (
                  <p className="mt-1 text-xs text-ink-soft">{t('kistiDueHint', { date: selectedKisti.dueDate.slice(0, 10) })}</p>
                ) : null}
              </label>
            ) : null}
            <label className="block">
              <span className={labelCls}>{t('paymentAmount')}</span>
              <input
                name="amount"
                type="number"
                min={1}
                step={1}
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                aria-invalid={Boolean(firstFieldError('amount'))}
                aria-describedby={firstFieldError('amount') ? 'amount-error' : undefined}
                className={`${inputCls} num`}
              />
              <FieldError id="amount-error" messages={firstFieldError('amount')} />
            </label>
            <label className="block">
              <span className={labelCls}>{t('depositMethod')}</span>
              <select
                name="depositMethod"
                required
                aria-invalid={Boolean(firstFieldError('depositMethod'))}
                aria-describedby={firstFieldError('depositMethod') ? 'depositMethod-error' : undefined}
                className={inputCls}
              >
                <option value="BANK_DEPOSIT">{tMethods('BANK_DEPOSIT')}</option>
                <option value="BANK_TRANSFER">{tMethods('BANK_TRANSFER')}</option>
                <option value="CHEQUE">{tMethods('CHEQUE')}</option>
                <option value="MOBILE_BANKING">{tMethods('MOBILE_BANKING')}</option>
              </select>
              <FieldError id="depositMethod-error" messages={firstFieldError('depositMethod')} />
            </label>
            <label className="block">
              <span className={labelCls}>{t('depositRef')}</span>
              <input
                name="depositRef"
                type="text"
                aria-invalid={Boolean(firstFieldError('depositRef'))}
                aria-describedby={firstFieldError('depositRef') ? 'depositRef-error' : undefined}
                className={inputCls}
              />
              <FieldError id="depositRef-error" messages={firstFieldError('depositRef')} />
            </label>
            <label className="block">
              <span className={labelCls}>{t('depositDate')}</span>
              <input
                name="depositDate"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                aria-invalid={Boolean(firstFieldError('depositDate'))}
                aria-describedby={firstFieldError('depositDate') ? 'depositDate-error' : undefined}
                className={inputCls}
              />
              <FieldError id="depositDate-error" messages={firstFieldError('depositDate')} />
            </label>
            <label className="block md:col-span-2">
              <span className={labelCls}>{t('note')}</span>
              <textarea
                name="note"
                rows={3}
                placeholder={t('paymentNotePlaceholder')}
                aria-invalid={Boolean(firstFieldError('note'))}
                aria-describedby={firstFieldError('note') ? 'note-error' : undefined}
                className={inputCls}
              />
              <FieldError id="note-error" messages={firstFieldError('note')} />
            </label>
            <label className="block md:col-span-2">
              <span className={labelCls}>{tReg('slipLabel')}</span>
              <input
                name="slipFile"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                aria-invalid={Boolean(firstFieldError('slipFile'))}
                aria-describedby={firstFieldError('slipFile') ? 'slipFile-error' : undefined}
                className={inputCls}
              />
              <FieldError id="slipFile-error" messages={firstFieldError('slipFile')} />
              <p className="text-xs text-ink-soft mt-1">{tReg('slipHelper', { max: '5 MB' })}</p>
            </label>
          </div>

          {investments.length === 0 ? (
            <p className="rounded-lg border border-amber/40 bg-amber-soft/70 px-4 py-3 text-sm text-ink">{t('noInvestments')}</p>
          ) : null}
        </>
      )}

      <div className="rounded-lg border border-line bg-panel p-4 text-sm">
        <p className="font-semibold">{t('depositNotice')}</p>
        <p className="mt-1 text-ink-soft">{tFooter('deposits')}</p>
        <p className="mt-2 text-ink-soft">{t('callUs', { phone: tFooter('phone') })}</p>
      </div>

      {/* ponytail: ceiling is text/transfer details only; add slip upload via lib/storage.ts when a verified bucket is available. */}

      <Button variant="primary" type="submit" disabled={pending}>
        {pending ? t('submitting') : kind === 'share' ? t('submit') : t('submitPayment')}
      </Button>
    </form>
  );
}
