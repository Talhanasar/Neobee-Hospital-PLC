'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { btnClasses } from '@/components/ui/bits';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Money } from '@/components/ui/Money';
import { BadgeCheckIcon, SearchIcon, SearchXIcon } from '@/components/ui/icons';

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

const dt = 'font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft';
const dd = 'mt-0.5 font-mono text-sm text-ink';

/**
 * Public code/UID lookup against the real register API. Confirms a
 * verification code or shareholder unique ID exists — nothing more.
 */
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

  return (
    <div className="mx-auto w-full">
      <div className="nb-card p-6 sm:p-8">
        <p className="text-sm leading-relaxed text-ink-soft">{t('lead')}</p>

        <form className="mt-5 flex gap-2" onSubmit={submit}>
          <label htmlFor="verify-input" className="sr-only">
            {t('inputLabel')}
          </label>
          <input
            id="verify-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('placeholder')}
            aria-label={t('inputLabel')}
            autoComplete="off"
            className="nb-input min-w-0 flex-1 font-mono uppercase tnum"
          />
          <button
            type="submit"
            disabled={loading}
            className={`${btnClasses('primary', 'md')} shrink-0 focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2`}
          >
            <SearchIcon size={16} aria-hidden="true" />
            {loading ? t('checking') : t('submit')}
          </button>
        </form>

        <div role="status" aria-live="polite">
          {error ? (
            <div className="mt-6 rounded-[14px] border border-amber/30 bg-amber-soft/60 p-5">
              <div className="flex items-center gap-2.5">
                <SearchXIcon size={18} className="text-amber" aria-hidden="true" />
                <p className="font-semibold text-ink">{error}</p>
              </div>
            </div>
          ) : null}

          {result ? (
            <div className="mt-6 rounded-[14px] border border-green/30 bg-green-soft/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <BadgeCheckIcon size={18} className="text-green" aria-hidden="true" />
                  <p className="font-semibold text-ink">{result.investorName}</p>
                </div>
                <StatusBadge status={result.status} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <div>
                  <dt className={dt}>{t('uid')}</dt>
                  <dd className={dd}>{result.uid}</dd>
                </div>
                <div>
                  <dt className={dt}>{t('code')}</dt>
                  <dd className={dd}>{result.code}</dd>
                </div>
                <div>
                  <dt className={dt}>{t('date')}</dt>
                  <dd className={dd}>{result.depositDate.slice(0, 10)}</dd>
                </div>
                <div>
                  <dt className={dt}>{t('shares')}</dt>
                  <dd className={dd}>{result.shares}</dd>
                </div>
                <div>
                  <dt className={dt}>{t('amount')}</dt>
                  <dd className={`${dd} font-semibold`}>
                    <Money value={result.amount} />
                  </dd>
                </div>
                <div className="flex items-end">
                  <CategoryBadge category={result.category} />
                </div>
              </dl>

              {result.status === 'PENDING' ? (
                <div className="mt-4 rounded-xl border border-amber/40 bg-amber-soft/70 p-3.5 text-[13px] text-ink">
                  {t('pendingNotice')}{' '}
                  <Link
                    href="/portal"
                    className={`${btnClasses('outline', 'sm')} ml-1 align-middle focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2`}
                  >
                    {t('signInToConfirm')}
                  </Link>
                </div>
              ) : (
                <div className="mt-4 rounded-xl px-3.5 py-2.5 text-[13px] text-green">{t('confirmedNotice')}</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-ink-soft">{t('note')}</p>
    </div>
  );
}
