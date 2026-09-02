'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { Money } from '@/components/ui/Money';
import { Num } from '@/components/ui/Num';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { KistiStatusBadge } from '@/components/ui/KistiStatusBadge';
import { KistiReceiptModal } from '@/components/portal/KistiReceiptModal';
import {
  submitInvestmentRequestAction,
  type SubmitInvestmentRequestState,
} from '@/app/[locale]/(dash)/portal/invest/actions';

const initialState: SubmitInvestmentRequestState = { ok: false, fieldErrors: {} };

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return <p id={id} className="mt-1 text-xs font-medium text-amber">{messages[0]}</p>;
}

export type InvestmentsTableRow = {
  id: string;
  uid: string;
  code: string;
  category: 'SHAREHOLDER' | 'PREMIUM' | 'DIRECTOR' | 'GOLDEN_DIRECTOR';
  shares: number;
  amount: number;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED';
  paymentPlan: 'FULL' | 'INSTALLMENT';
  depositDate: string; // ISO date
  confirmedAt: string | null;
  kistis: Array<{
    id: string;
    installmentNo: number;
    amount: number;
    dueDate: string; // ISO date
    status: 'SCHEDULED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    pendingClaim: boolean; // a PAYMENT request for this kisti is in the admin queue
  }>;
};

const focusRing = 'focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';
const labelCls = 'block text-[12.5px] font-semibold mb-1.5';
const inputCls = `w-full border border-line rounded-lg px-3 py-2 bg-panel ${focusRing}`;

/** Per-kisti "report paid" claim form — deposit details that staff verify. */
function ClaimKistiForm({ row, kisti, onDone }: { row: InvestmentsTableRow; kisti: InvestmentsTableRow['kistis'][number]; onDone: () => void }) {
  const t = useTranslations('portal');
  const tInvest = useTranslations('invest');
  const tMethods = useTranslations('methods');
  const [state, action, pending] = useActionState(submitInvestmentRequestAction, initialState);
  const fieldErrors = state.ok === false ? state.fieldErrors : {};

  React.useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="mt-3 space-y-3 rounded-lg border border-honey/40 bg-honey-soft/30 p-4">
      <input type="hidden" name="kind" value="PAYMENT" />
      <input type="hidden" name="targetInvestmentId" value={row.id} />
      <input type="hidden" name="installmentNo" value={kisti.installmentNo} />
      <input type="hidden" name="amount" value={kisti.amount} />
      <p className="text-sm font-semibold text-ink">
        {tInvest('kistiLabel', { no: kisti.installmentNo })} · <Money value={kisti.amount} />
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>{tInvest('depositMethod')}</span>
          <select name="depositMethod" required className={inputCls}>
            <option value="BANK_DEPOSIT">{tMethods('BANK_DEPOSIT')}</option>
            <option value="BANK_TRANSFER">{tMethods('BANK_TRANSFER')}</option>
            <option value="CHEQUE">{tMethods('CHEQUE')}</option>
            <option value="MOBILE_BANKING">{tMethods('MOBILE_BANKING')}</option>
          </select>
          <FieldError id={`claim-${kisti.id}-method`} messages={fieldErrors.depositMethod} />
        </label>
        <label className="block">
          <span className={labelCls}>{tInvest('depositRef')}</span>
          <input name="depositRef" type="text" className={inputCls} />
          <FieldError id={`claim-${kisti.id}-ref`} messages={fieldErrors.depositRef} />
        </label>
        <label className="block">
          <span className={labelCls}>{tInvest('depositDate')}</span>
          <input name="depositDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
          <FieldError id={`claim-${kisti.id}-date`} messages={fieldErrors.depositDate} />
        </label>
        <label className="block">
          <span className={labelCls}>{tInvest('note')}</span>
          <input name="note" type="text" placeholder={tInvest('paymentNotePlaceholder')} className={inputCls} />
          <FieldError id={`claim-${kisti.id}-note`} messages={fieldErrors.note} />
        </label>
      </div>
      {state.ok === false && state.formError ? (
        <p role="alert" className="rounded-lg bg-[#FBE4E2] px-3 py-2 text-xs text-[#B3261E]">
          {state.formError === 'openRequestCap' ? tInvest('errorOpenCap')
            : state.formError === 'kistiAlreadyClaimed' ? t('claimAlreadyPending')
            : state.formError === 'authRequired' ? t('errorAuth')
            : t('errorGeneric')}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className={`inline-flex h-9 items-center rounded-lg bg-honey px-3.5 text-sm font-semibold text-ink hover:bg-honey-deep disabled:opacity-50 ${focusRing}`}
        >
          {pending ? t('accountSaving') : t('claimSubmit')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className={`inline-flex h-9 items-center rounded-lg border border-line bg-panel px-3.5 text-sm font-semibold text-ink hover:border-honey ${focusRing}`}
        >
          {t('claimCancel')}
        </button>
      </div>
    </form>
  );
}

/** Investments table: one row per investment, expandable kisti dropdown with
    the report-paid claim on the upcoming kisti and receipt links once paid. */
export default function InvestmentsTable({ rows }: { rows: InvestmentsTableRow[] }) {
  const t = useTranslations('portal');
  const tInvest = useTranslations('invest');
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [claimId, setClaimId] = React.useState<string | null>(null); // `${investmentId}:${installmentNo}`

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-line bg-panel p-6">
        <h2 className="font-semibold">{t('requestEmpty')}</h2>
        <p className="mt-2 text-ink-soft">{t('requestEmptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-panel">
      <table className="w-full border-collapse md:min-w-0 min-w-[860px]">
        <caption className="sr-only">{t('investmentsTableCaption')}</caption>
        <thead>
          <tr>
            <th scope="col" className="whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{t('uid')}</th>
            <th scope="col" className="whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{tInvest('colPlan')}</th>
            <th scope="col" className="whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{t('shares')}</th>
            <th scope="col" className="whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{t('amountPaid')}</th>
            <th scope="col" className="whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{t('date')}</th>
            <th scope="col" className="whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{t('kistiStatus')}</th>
            <th scope="col" className="whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{t('colActionsInline')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const last = index === rows.length - 1;
            const paid = row.kistis.filter((k) => k.status === 'PAID').length;
            const rowBorder = ['px-4 py-3 border-b border-line text-sm align-middle', last && row.paymentPlan !== 'INSTALLMENT' ? 'border-b-0' : ''].join(' ');
            const nextKisti = row.kistis.find((k) => k.status === 'SCHEDULED' || k.status === 'OVERDUE') ?? null;
            return (
              <React.Fragment key={row.id}>
                <tr className="hover:bg-honey-soft/50">
                  <td className={`num ${rowBorder}`}>
                    <div className="font-semibold">{row.uid}</div>
                    <CategoryBadge category={row.category} />
                  </td>
                  <td className={rowBorder}>
                    {row.paymentPlan === 'INSTALLMENT' ? (
                      <span className="text-xs font-semibold text-violet">
                        {t('kistiProgress', { paid, total: row.kistis.length })}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-soft">{tInvest('planFullLabel')}</span>
                    )}
                  </td>
                  <td className={rowBorder}><Num value={row.shares} /></td>
                  <td className={rowBorder}><Money value={row.amount} /></td>
                  <td className={`num ${rowBorder}`}>{row.depositDate.slice(0, 10)}</td>
                  <td className={rowBorder}><StatusBadge status={row.status} /></td>
                  <td className={`${rowBorder} whitespace-nowrap text-right`}>
                    <div className="inline-flex gap-2">
                      {row.paymentPlan !== 'INSTALLMENT' ? (
                        <Link href={`/portal/receipts/${row.id}`} className="inline-flex h-8 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold text-ink hover:border-honey">
                          {t('viewReceipt')}
                        </Link>
                      ) : null}
                      {row.kistis.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setOpenId(openId === row.id ? null : row.id)}
                          aria-expanded={openId === row.id}
                          className={`inline-flex h-8 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold text-honey-deep hover:border-honey ${focusRing}`}
                        >
                          {openId === row.id ? t('kistiHide') : t('kistiToggleShort', { uid: row.uid })}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                {row.paymentPlan === 'INSTALLMENT' && row.kistis.length > 0 && openId === row.id ? (
                  <tr className="bg-paper/60">
                    <td colSpan={7} className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse text-xs">
                          <thead>
                            <tr className="text-left">
                              <th scope="col" className="py-1.5 pr-4 font-mono uppercase tracking-[0.1em] text-ink-soft">{t('kistiId')}</th>
                              <th scope="col" className="py-1.5 pr-4 font-mono uppercase tracking-[0.1em] text-ink-soft">{t('kistiAmount')}</th>
                              <th scope="col" className="py-1.5 pr-4 font-mono uppercase tracking-[0.1em] text-ink-soft">{t('kistiDue')}</th>
                              <th scope="col" className="py-1.5 pr-4 font-mono uppercase tracking-[0.1em] text-ink-soft">{t('kistiStatus')}</th>
                              <th scope="col" className="py-1.5 font-mono uppercase tracking-[0.1em] text-ink-soft">{t('colActionsInline')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.kistis.map((k) => {
                              const claimKey = `${row.id}:${k.installmentNo}`;
                              const canClaim = (k.status === 'SCHEDULED' || k.status === 'OVERDUE') && !k.pendingClaim;
                              const isNext = nextKisti?.installmentNo === k.installmentNo;
                              return (
                                <tr key={k.id} className="border-t border-line">
                                  <td className="num py-2 pr-4 font-mono">{`${row.uid}-K${k.installmentNo}`}</td>
                                  <td className="py-2 pr-4"><Money value={k.amount} /></td>
                                  <td className="num py-2 pr-4">{k.dueDate.slice(0, 10)}</td>
                                  <td className="py-2 pr-4"><KistiStatusBadge status={k.status} pendingClaim={k.pendingClaim} /></td>
                                  <td className="py-2">
                                    {k.status === 'PAID' ? (
                                      <KistiReceiptModal investmentId={row.id} uid={row.uid} installmentNo={k.installmentNo} />
                                    ) : canClaim ? (
                                      <div>
                                        {isNext ? (
                                          <span className="mr-2 rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-semibold text-amber">{t('kistiUpcoming')}</span>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => setClaimId(claimId === claimKey ? null : claimKey)}
                                          aria-expanded={claimId === claimKey}
                                          className={`inline-flex h-7 items-center rounded-lg bg-honey px-2.5 text-[12px] font-semibold text-ink hover:bg-honey-deep ${focusRing}`}
                                        >
                                          {t('claimPaid')}
                                        </button>
                                        {claimId === claimKey ? (
                                          <ClaimKistiForm row={row} kisti={k} onDone={() => setClaimId(null)} />
                                        ) : null}
                                      </div>
                                    ) : (
                                      <span className="text-ink-soft">{t('kistiAwaitingVerification')}</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
