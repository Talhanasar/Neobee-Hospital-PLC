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
  MIN_SHARES 
} from '@/lib/money';
import { approveRequestAction, rejectRequestAction, type ReviewState } from '@/app/[locale]/(dash)/admin/requests/actions';
import type { RequestForReview } from '@/lib/queries';

const initialReviewState: ReviewState = { ok: false, fieldErrors: {} };

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return <p id={id} className="mt-1 text-xs text-[#B3261E]">{messages[0]}</p>;
}

interface ReviewRequestFormProps {
  request: RequestForReview;
  sharePrice: number;
  incentivePerShare: number;
}

export function ReviewRequestForm({ request, sharePrice, incentivePerShare }: ReviewRequestFormProps) {
  const t = useTranslations('admin');
  const tMethods = useTranslations('methods');

  const [approveState, approveAction, approvePending] = useActionState(
    approveRequestAction.bind(null, request.id),
    initialReviewState
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectRequestAction.bind(null, request.id),
    initialReviewState
  );

  // Approve form state
  const [shares, setShares] = React.useState(request.shares.toString());
  const [isEntrepreneur, setIsEntrepreneur] = React.useState(request.entrepreneurRequested);
  const [depositMethod, setDepositMethod] = React.useState(request.depositMethod);
  const [depositRef, setDepositRef] = React.useState(request.depositRef ?? '');
  const [depositDate, setDepositDate] = React.useState(request.depositDate.toISOString().slice(0, 10));
  const [reviewNote, setReviewNote] = React.useState('');

  // Compute live preview
  const shareCount = Number(shares);
  const canPreview = Number.isInteger(shareCount) && shares !== '';
  const category = canPreview && shareCount >= MIN_SHARES ? deriveCategory(shareCount) : null;
  const amount = canPreview ? calculateAmount(shareCount, sharePrice) : null;
  const incentive = canPreview && isEntrepreneur ? calculateIncentive(shareCount, true, incentivePerShare) : null;
  const showEntrepreneurWarning = isEntrepreneur && canPreview && shareCount < ENTREPRENEUR_MIN_SHARES;

  // Check if any field changed from original
  const isModified = 
    Number(shares) !== request.shares ||
    isEntrepreneur !== request.entrepreneurRequested ||
    depositMethod !== request.depositMethod ||
    depositRef !== (request.depositRef ?? '') ||
    depositDate !== request.depositDate.toISOString().slice(0, 10);

  const pending = approvePending || rejectPending;

  // Success states
  const approveSuccess = approveState.ok === true;
  const rejectSuccess = rejectState.ok === true;

  return (
    <div className="space-y-6">
      {approveSuccess && (
        <div role="status" className="bg-green-soft text-green rounded-card px-4 py-3">
          {t('approveSuccess', { investmentId: approveState.investmentId ?? 'N/A' })}
          {approveState.investmentId ? (
            <Link href={`/admin/receipts/${approveState.investmentId}`} className="ml-2 underline">
              {t('approveSuccessReceipt')}
            </Link>
          ) : null}
        </div>
      )}
      {rejectSuccess && (
        <div role="status" className="bg-green-soft text-green rounded-card px-4 py-3">
          {t('rejectSuccess')}
        </div>
      )}
      {(approveState.ok === false && approveState.formError) && (
        <div role="alert" className="bg-[#FBE4E2] text-[#B3261E] rounded-card px-4 py-3">
          {approveState.formError}
        </div>
      )}
      {(rejectState.ok === false && rejectState.formError) && (
        <div role="alert" className="bg-[#FBE4E2] text-[#B3261E] rounded-card px-4 py-3">
          {rejectState.formError}
        </div>
      )}

      {/* APPROVE FORM */}
      <section className="bg-panel border border-line rounded-card p-5 space-y-5" aria-labelledby="approve-heading">
        <h3 id="approve-heading" className="font-display text-lg font-bold">{t('approveTitle')}</h3>
        <p className="text-sm text-ink-soft">{t('approveLead')}</p>

        <form action={approveAction} className="space-y-4">
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
                aria-invalid={Boolean(approveState.ok === false && approveState.fieldErrors.shares)}
                aria-describedby={approveState.ok === false && approveState.fieldErrors.shares ? 'shares-error' : undefined}
                className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
                disabled={pending}
              />
              <FieldError id="shares-error" messages={approveState.ok === false ? approveState.fieldErrors.shares : undefined} />
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
                value={depositMethod}
                onChange={(e) => setDepositMethod(e.target.value as 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING')}
                aria-invalid={Boolean(approveState.ok === false && approveState.fieldErrors.depositMethod)}
                aria-describedby={approveState.ok === false && approveState.fieldErrors.depositMethod ? 'depositMethod-error' : undefined}
                className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
                disabled={pending}
              >
                <option value="BANK_DEPOSIT">{tMethods('BANK_DEPOSIT')}</option>
                <option value="BANK_TRANSFER">{tMethods('BANK_TRANSFER')}</option>
                <option value="CHEQUE">{tMethods('CHEQUE')}</option>
                <option value="MOBILE_BANKING">{tMethods('MOBILE_BANKING')}</option>
              </select>
              <FieldError id="depositMethod-error" messages={approveState.ok === false ? approveState.fieldErrors.depositMethod : undefined} />
            </label>
            <label className="block">
              <span className="block text-[12.5px] font-semibold mb-1.5">{t('depositRef')}</span>
              <input
                name="depositRef"
                type="text"
                value={depositRef}
                onChange={(e) => setDepositRef(e.target.value)}
                aria-invalid={Boolean(approveState.ok === false && approveState.fieldErrors.depositRef)}
                aria-describedby={approveState.ok === false && approveState.fieldErrors.depositRef ? 'depositRef-error' : undefined}
                className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
                disabled={pending}
              />
              <FieldError id="depositRef-error" messages={approveState.ok === false ? approveState.fieldErrors.depositRef : undefined} />
            </label>
            <label className="block">
              <span className="block text-[12.5px] font-semibold mb-1.5">{t('depositDate')}</span>
              <input
                name="depositDate"
                type="date"
                required
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                aria-invalid={Boolean(approveState.ok === false && approveState.fieldErrors.depositDate)}
                aria-describedby={approveState.ok === false && approveState.fieldErrors.depositDate ? 'depositDate-error' : undefined}
                className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
                disabled={pending}
              />
              <FieldError id="depositDate-error" messages={approveState.ok === false ? approveState.fieldErrors.depositDate : undefined} />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-[12.5px] font-semibold mb-1.5">{t('reviewNoteOptional')}</span>
              <textarea
                name="reviewNote"
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                aria-invalid={Boolean(approveState.ok === false && approveState.fieldErrors.reviewNote)}
                aria-describedby={approveState.ok === false && approveState.fieldErrors.reviewNote ? 'reviewNote-error' : undefined}
                className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
                disabled={pending}
              />
              <FieldError id="reviewNote-error" messages={approveState.ok === false ? approveState.fieldErrors.reviewNote : undefined} />
            </label>
          </div>

          <label className="flex items-start gap-2.5">
            {/* Hidden companion input ensures a boolean is always submitted.
                When checkbox is checked, its value="true" comes after and wins via FormData.getAll. */}
            <input type="hidden" name="isEntrepreneur" value="false" />
            <input
              type="checkbox"
              name="isEntrepreneur"
              value="true"
              checked={isEntrepreneur}
              onChange={(e) => setIsEntrepreneur(e.target.checked)}
              className="mt-1 h-[17px] w-[17px] accent-[var(--color-honey-deep)]"
              disabled={pending}
            />
            <span className="text-sm">{t.rich('entrepreneurExplainer', { b: (chunks) => <b>{chunks}</b> })}</span>
          </label>
          {showEntrepreneurWarning ? <p className="text-xs text-[#B3261E]">{t('entrepreneurWarning')}</p> : null}

          {/* Live preview panel */}
          <div className="bg-honey-soft border border-[#EFD9A4] rounded-[10px] px-4 py-3.5 text-[13.5px]">
            <div className="flex justify-between gap-3 py-[3px]">
              <span>
                {canPreview ? (
                  <>
                    {t('calcShares', { shares: shareCount.toLocaleString('en-IN') })} <Money value={sharePrice} />
                  </>
                ) : (
                  t('calcSharesEmpty')
                )}
              </span>
              <span>{amount == null ? '—' : <Money value={amount} />}</span>
            </div>
            {isEntrepreneur ? (
              <div className="flex justify-between gap-3 py-[3px]">
                <span>
                  {canPreview ? (
                    <>
                      {t('calcIncentive', { shares: shareCount.toLocaleString('en-IN') })} <Money value={incentivePerShare} />
                    </>
                  ) : (
                    t('calcSharesEmpty')
                  )}
                </span>
                <span>{incentive == null ? '—' : <Money value={incentive} />}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 py-[3px] border-t border-dashed border-[#D9BE79] mt-1.5 pt-2 font-semibold">
              <span>{t('calcTotal')}</span>
              <span>{amount == null ? '—' : <Money value={amount} />}</span>
            </div>
          </div>

          {/* Modification consequence notice */}
          <div className={`rounded-lg p-3 text-sm border ${isModified ? 'bg-amber-soft border-amber text-ink' : 'bg-green-soft border-green text-green'}`}>
            <p className="font-semibold">
              {isModified ? t('modifiedWarningTitle') : t('unchangedNoticeTitle')}
            </p>
            <p className="mt-1">
              {isModified 
                ? t('modifiedWarningBody')
                : t('unchangedNoticeBody')
              }
            </p>
          </div>

          <Button variant="primary" type="submit" disabled={pending}>
            {approvePending ? t('approvePending') : t('approveSubmit')}
          </Button>
        </form>
      </section>

      {/* REJECT FORM */}
      <section className="bg-panel border border-line rounded-card p-5 space-y-5" aria-labelledby="reject-heading">
        <h3 id="reject-heading" className="font-display text-lg font-bold">{t('rejectTitle')}</h3>
        <p className="text-sm text-ink-soft">{t('rejectLead')}</p>

        <form action={rejectAction} className="space-y-4">
          <label className="block">
            <span className="block text-[12.5px] font-semibold mb-1.5">{t('reviewNoteRequired')}</span>
            <textarea
              name="reviewNote"
              rows={4}
              required
              aria-invalid={Boolean(rejectState.ok === false && rejectState.fieldErrors.reviewNote)}
              aria-describedby={rejectState.ok === false && rejectState.fieldErrors.reviewNote ? 'rejectReviewNote-error' : undefined}
              className="w-full border border-line rounded-lg px-3.5 py-2.5 bg-panel focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
              disabled={pending}
            />
            <FieldError id="rejectReviewNote-error" messages={rejectState.ok === false ? rejectState.fieldErrors.reviewNote : undefined} />
            <p className="mt-1 text-xs text-ink-soft">{t('rejectNoteHint')}</p>
          </label>

          <Button variant="default" type="submit" disabled={pending} className="bg-[#FBE4E2] border-[#E8A098] text-[#B3261E] hover:bg-[#F5D0CE]">
            {rejectPending ? t('rejectPending') : t('rejectSubmit')}
          </Button>
        </form>
      </section>
    </div>
  );
}