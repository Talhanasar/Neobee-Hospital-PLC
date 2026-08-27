'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button, buttonClasses } from '@/components/ui/Button';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Money } from '@/components/ui/Money';

type Result = {
  uid: string;
  code: string;
  investorName: string;
  shares: number;
  amount: number;
  category: 'SHAREHOLDER' | 'PREMIUM' | 'DIRECTOR';
  status: 'PENDING' | 'CONFIRMED';
  depositDate: string;
};

export default function VerifyLookup() {
  const t = useTranslations('verify');
  const [value, setValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const input = value.trim();
    if (!input) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const query = /^NEO-\d{4,}$/.test(input) ? `uid=${encodeURIComponent(input)}` : `code=${encodeURIComponent(input.toUpperCase())}`;
    try {
      const response = await fetch(`/api/investments/verify?${query}`);
      if (response.status === 200) {
        setResult(await response.json());
      } else if (response.status === 400) {
        setError(t('errorFormat'));
      } else if (response.status === 404) {
        setError(t('errorNotFound'));
      } else if (response.status === 429) {
        setError(t('errorRateLimited'));
      } else {
        setError(t('errorGeneric'));
      }
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return <div className="space-y-5">
    <form onSubmit={submit} className="flex gap-2.5">
      <label className="sr-only" htmlFor="verify-input">{t('inputLabel')}</label>
      <input id="verify-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('placeholder')} aria-label={t('inputLabel')} className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3.5 py-2.5 text-ink placeholder:text-ink-soft/70 focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2" />
      <Button type="submit" disabled={loading}>{loading ? t('checking') : t('submit')}</Button>
    </form>
    <div role="status" aria-live="polite">
      {error ? <div className="rounded-lg px-3.5 py-2.5 text-[13px] mt-3.5 bg-[#FBE4E2] text-[#B3261E]">{error}</div> : null}
      {result ? <div className="bg-panel border border-line rounded-card p-6">
        <div className="flex flex-wrap items-center gap-2.5 mb-4">
          <h3 className="text-[20px] font-semibold">{result.investorName}</h3>
          <CategoryBadge category={result.category} />
          <StatusBadge status={result.status} />
        </div>
        <dl className="grid gap-y-2 gap-x-3.5 [grid-template-columns:170px_1fr] max-md:grid-cols-1 max-md:[grid-template-columns:1fr]">
          <dt className="text-ink-soft max-md:mt-2.5">{t('uid')}</dt><dd className="num">{result.uid}</dd>
          <dt className="text-ink-soft max-md:mt-2.5">{t('code')}</dt><dd className="num">{result.code}</dd>
          <dt className="text-ink-soft max-md:mt-2.5">{t('shares')}</dt><dd className="num">{result.shares}</dd>
          <dt className="text-ink-soft max-md:mt-2.5">{t('amount')}</dt><dd><Money value={result.amount} /></dd>
          <dt className="text-ink-soft max-md:mt-2.5">{t('date')}</dt><dd className="num">{result.depositDate.slice(0, 10)}</dd>
        </dl>
        {result.status === 'PENDING' ? <div className="rounded-lg px-3.5 py-2.5 text-[13px] mt-3.5 bg-amber-soft text-ink">{t('pendingNotice')} <Link href="/portal" className={buttonClasses('primary', 'sm') + ' ml-2 align-middle'}>{t('signInToConfirm')}</Link></div> : <div className="rounded-lg px-3.5 py-2.5 text-[13px] mt-3.5 bg-green-soft text-green">{t('confirmedNotice')}</div>}
      </div> : null}
    </div>
  </div>;
}
