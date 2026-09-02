'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { Money } from '@/components/ui/Money';
import { calculateAmount, calculateIncentive, deriveCategory, ENTREPRENEUR_MIN_SHARES, MAX_SHARES, MIN_SHARES } from '@/lib/money';
import { useTranslations } from 'next-intl';
import { registerInvestmentAction, type RegisterState } from '@/app/[locale]/(dash)/admin/register/actions';


const initialState: RegisterState = { ok: false, fieldErrors: {} };

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return <p id={id} className="mt-1 text-xs text-[#B3261E]">{messages[0]}</p>;
}

export function RegisterForm({ sharePrice, incentivePerShare }: { sharePrice: number; incentivePerShare: number }) {
  const t = useTranslations('admin');
  const [state, action, pending] = useActionState(registerInvestmentAction, initialState);
  const [shares, setShares] = React.useState('');
  const [isEntrepreneur, setIsEntrepreneur] = React.useState(false);
  const shareCount = Number(shares);
  const canPreview = Number.isInteger(shareCount) && shares !== '';
  const category = canPreview && shareCount >= MIN_SHARES ? deriveCategory(shareCount) : null;
  const amount = canPreview ? calculateAmount(shareCount, sharePrice) : null;
  const incentive = canPreview && isEntrepreneur ? calculateIncentive(shareCount, true, incentivePerShare) : null;
  const showEntrepreneurWarning = isEntrepreneur && canPreview && shareCount < ENTREPRENEUR_MIN_SHARES;
  const success = state.ok ? state : null;

  return (
    <form action={action} className="space-y-5">
      {success ? <div role="status" className="bg-green-soft text-green rounded-card px-4 py-3">{t('success', { uid: success.uid, code: success.code })} {success.id ? <Link href={`/admin/receipts/${success.id}`} className="underline">{t('successReceipt')}</Link> : <Link href="/admin" className="underline">{t('successAdmin')}</Link>}{success.accountCreated ? ` ${t('accountCreatedNote')}` : null}</div> : null}
      {state.ok === false && state.formError ? <div role="alert" className="bg-[#FBE4E2] text-[#B3261E] rounded-card px-4 py-3">{state.formError}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {/* client-supplied category must never be trusted; server derives it. */}
        <label className="block"><span className="block text-[12.5px] font-semibold mb-1.5">{t('name')}</span><input name="name" aria-invalid={Boolean(state.ok === false && state.fieldErrors.name)} aria-describedby={state.ok === false && state.fieldErrors.name ? 'name-error' : undefined} placeholder={t('namePlaceholder')} className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 outline-honey-deep border-honey" /><FieldError id="name-error" messages={state.ok === false ? state.fieldErrors.name : undefined} /></label>
        <label className="block"><span className="block text-[12.5px] font-semibold mb-1.5">{t('phone')}</span><input name="phone" aria-invalid={Boolean(state.ok === false && state.fieldErrors.phone)} aria-describedby={state.ok === false && state.fieldErrors.phone ? 'phone-error' : undefined} inputMode="tel" placeholder={t('phonePlaceholder')} className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 outline-honey-deep border-honey" /><FieldError id="phone-error" messages={state.ok === false ? state.fieldErrors.phone : undefined} /><p className="text-xs text-ink-soft mt-1">{t('phoneHelp')}</p></label>
        <label className="block"><span className="block text-[12.5px] font-semibold mb-1.5">{t('email')}</span><input name="email" aria-invalid={Boolean(state.ok === false && state.fieldErrors.email)} aria-describedby={state.ok === false && state.fieldErrors.email ? 'email-error' : undefined} type="email" className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 outline-honey-deep border-honey" /><FieldError id="email-error" messages={state.ok === false ? state.fieldErrors.email : undefined} /></label>
        <label className="block"><span className="block text-[12.5px] font-semibold mb-1.5">{t('accountPassword')}</span><input name="accountPassword" aria-invalid={Boolean(state.ok === false && state.fieldErrors.accountPassword)} aria-describedby={state.ok === false && state.fieldErrors.accountPassword ? 'accountPassword-error' : undefined} type="password" autoComplete="new-password" className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 outline-honey-deep border-honey" /><FieldError id="accountPassword-error" messages={state.ok === false ? state.fieldErrors.accountPassword : undefined} /><p className="text-xs text-ink-soft mt-1">{t('accountPasswordHelp')}</p></label>
        <label className="block"><span className="block text-[12.5px] font-semibold mb-1.5">{t('nid')}</span><input name="nationalIdNumber" aria-invalid={Boolean(state.ok === false && state.fieldErrors.nationalIdNumber)} aria-describedby={state.ok === false && state.fieldErrors.nationalIdNumber ? 'nationalIdNumber-error' : undefined} className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 outline-honey-deep border-honey" /><FieldError id="nationalIdNumber-error" messages={state.ok === false ? state.fieldErrors.nationalIdNumber : undefined} /></label>
        <label className="block"><span className="block text-[12.5px] font-semibold mb-1.5">{t('shares')}</span><input name="shares" aria-invalid={Boolean(state.ok === false && state.fieldErrors.shares)} aria-describedby={state.ok === false && state.fieldErrors.shares ? 'shares-error' : undefined} type="number" min={MIN_SHARES} max={MAX_SHARES} step={1} required value={shares} onChange={(e) => setShares(e.target.value)} className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 outline-honey-deep border-honey" /><FieldError id="shares-error" messages={state.ok === false ? state.fieldErrors.shares : undefined} /></label>
        <div className="block"><span className="block text-[12.5px] font-semibold mb-1.5">{t('category')}</span><div className="px-3 py-2.5 border border-line rounded-lg bg-paper min-h-[44px] flex items-center">{category ? <CategoryBadge category={category} /> : <span className="text-ink-soft">—</span>}</div></div>
        <label className="block"><span className="block text-[12.5px] font-semibold mb-1.5">{t('depositDate')}</span><input name="depositDate" aria-invalid={Boolean(state.ok === false && state.fieldErrors.depositDate)} aria-describedby={state.ok === false && state.fieldErrors.depositDate ? 'depositDate-error' : undefined} type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 outline-honey-deep border-honey" /><FieldError id="depositDate-error" messages={state.ok === false ? state.fieldErrors.depositDate : undefined} /></label>
        <label className="block"><span className="block text-[12.5px] font-semibold mb-1.5">{t('depositMethod')}</span><select name="depositMethod" aria-invalid={Boolean(state.ok === false && state.fieldErrors.depositMethod)} aria-describedby={state.ok === false && state.fieldErrors.depositMethod ? 'depositMethod-error' : undefined} defaultValue="BANK_DEPOSIT" className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 outline-honey-deep border-honey"><option value="BANK_DEPOSIT">{t('methodBankDeposit')}</option><option value="BANK_TRANSFER">{t('methodBankTransfer')}</option><option value="CHEQUE">{t('methodCheque')}</option><option value="MOBILE_BANKING">{t('methodMobileBanking')}</option></select><FieldError id="depositMethod-error" messages={state.ok === false ? state.fieldErrors.depositMethod : undefined} /></label>
        <label className="block"><span className="block text-[12.5px] font-semibold mb-1.5">{t('depositRef')}</span><input name="depositRef" aria-invalid={Boolean(state.ok === false && state.fieldErrors.depositRef)} aria-describedby={state.ok === false && state.fieldErrors.depositRef ? 'depositRef-error' : undefined} className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 outline-honey-deep border-honey" /><FieldError id="depositRef-error" messages={state.ok === false ? state.fieldErrors.depositRef : undefined} /></label>
        <label className="block md:col-span-2"><span className="block text-[12.5px] font-semibold mb-1.5">{t('notes')}</span><textarea name="notes" aria-invalid={Boolean(state.ok === false && state.fieldErrors.notes)} aria-describedby={state.ok === false && state.fieldErrors.notes ? 'notes-error' : undefined} rows={4} className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 outline-honey-deep border-honey" /><FieldError id="notes-error" messages={state.ok === false ? state.fieldErrors.notes : undefined} /></label>
      </div>
      <label className="flex items-start gap-2.5"><input type="checkbox" name="isEntrepreneur" checked={isEntrepreneur} onChange={(e) => setIsEntrepreneur(e.target.checked)} className="mt-1 h-[17px] w-[17px] accent-[var(--color-honey-deep)]" /><span className="text-sm">{t.rich('entrepreneurExplainer', { b: (chunks) => <b>{chunks}</b> })}</span></label>
      {showEntrepreneurWarning ? <p className="text-xs text-[#B3261E]">{t('entrepreneurWarning')}</p> : null}
      <div className="bg-honey-soft border border-[#EFD9A4] rounded-[10px] px-4 py-3.5 text-[13.5px]">
        <div className="flex justify-between gap-3 py-[3px]"><span>{canPreview ? <>{t('calcShares', { shares: shareCount.toLocaleString('en-IN') })} <Money value={sharePrice} /></> : t('calcSharesEmpty')}</span><span>{amount == null ? '—' : <Money value={amount} />}</span></div>
        {isEntrepreneur ? <div className="flex justify-between gap-3 py-[3px]"><span>{t('calcIncentive', { shares: shareCount.toLocaleString('en-IN') })} <Money value={incentivePerShare} /></span><span>{incentive == null ? '—' : <Money value={incentive} />}</span></div> : null}
        <div className="flex justify-between gap-3 py-[3px] border-t border-dashed border-[#D9BE79] mt-1.5 pt-2 font-semibold"><span>{t('calcTotal')}</span><span>{amount == null ? '—' : <Money value={amount} />}</span></div>
      </div>
      <Button variant="primary" type="submit" disabled={pending}>{pending ? t('submitPending') : t('submit')}</Button>
    </form>
  );
}
