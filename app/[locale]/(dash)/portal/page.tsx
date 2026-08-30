export const dynamic = 'force-dynamic';

import { Link, redirect } from '@/i18n/navigation';
import { requireInvestor, getSessionContext } from '@/lib/auth';
import { listInvestmentsForInvestor, listRequestsForInvestor } from '@/lib/queries';
import { Card, CardHead } from '@/components/ui/Card';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Money } from '@/components/ui/Money';
import { StatCard } from '@/components/ui/StatCard';
import { buttonClasses } from '@/components/ui/Button';
import ConfirmButton from '@/components/portal/ConfirmButton';
import { getTranslations } from 'next-intl/server';

export default async function PortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSessionContext();
  // Unauthenticated visitors go to sign-in; signed-in users without a linked
  // Investor record get a friendly empty state instead of an error loop.
  if (!session.user) redirect({ href: '/login', locale });
  const t = await getTranslations({ locale, namespace: 'portal' });
  const methodT = await getTranslations({ locale, namespace: 'methods' });
  if (!session.isInvestor) {
    return <div className="space-y-6"><section className="space-y-3"><h1 className="font-display text-[38px] font-bold leading-tight">{t('title')}</h1></section><div className="rounded-card border border-line bg-panel p-6"><h2 className="font-semibold">{t('emptyStateTitle')}</h2><p className="mt-2 text-ink-soft">{t('emptyStateBody')}</p><Link href="/" className="mt-4 inline-block underline">{t('emptyStateCta')}</Link></div></div>;
  }
  const investor = await requireInvestor();
  const rows = await listInvestmentsForInvestor(investor.id);
  const requests = await listRequestsForInvestor(investor.id);
  const hasContent = rows.length > 0 || requests.length > 0;
  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);
  const totalShares = rows.reduce((sum, r) => sum + r.shares, 0);
  const latest = rows[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="nb-kicker flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 bg-honey hex-clip" />
            {t('kicker')}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">{t('greeting', { name: investor.name })}</h1>
        </div>
        <div className="nb-card px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">{t('phoneChip')}</p>
          <span className="num mt-0.5 block text-sm font-semibold text-ink">{investor.phone}</span>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/portal/invest" className={buttonClasses('primary')}>{t('requestSubmit')}</Link>
        <Link href="/portal/account" className={buttonClasses('default')}>{t('accountDetails')}</Link>
        <Link href="/portal/password" className={buttonClasses('default')}>{t('changePassword')}</Link>
      </div>

      {rows.length > 0 ? (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          <StatCard label={t('statTotalInvested')} value={<Money value={totalAmount} />} hint={t('statReceipts', { count: rows.length.toLocaleString('en-IN') })} />
          <StatCard label={t('statTotalShares')} value={<span className="num font-display text-2xl font-bold">{totalShares.toLocaleString('en-IN')}</span>} tone="confirmed" />
          <StatCard label={t('statCategory')} value={latest ? <CategoryBadge category={latest.category} /> : '—'} />
          <StatCard
            label={t('statLatestDeposit')}
            value={<span className="num font-display text-2xl font-bold">{latest ? latest.depositDate.toISOString().slice(0, 10) : '—'}</span>}
            hint={latest ? (latest.status === 'CONFIRMED' ? t('statusConfirmed') : t('statusPending')) : undefined}
            tone={latest?.status === 'CONFIRMED' ? 'confirmed' : undefined}
          />
        </div>
      ) : null}

      {hasContent ? null : (
        <div className="rounded-card border border-line bg-panel p-6">
          <h2 className="font-semibold">{t('requestEmpty')}</h2>
          <p className="mt-2 text-ink-soft">{t('requestEmptyHint')}</p>
        </div>
      )}

      {requests.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-[22px] font-bold leading-tight">{t('requestTitle')}</h2>
          <div className="space-y-3">
            {requests.map((row) => (
              <Card key={row.id}>
                <CardHead>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-sm">{row.id.slice(-8)}</span>
                    <StatusBadge status={row.status === 'SUBMITTED' ? 'PENDING' : row.status === 'APPROVED' ? 'CONFIRMED' : 'PENDING'} />
                    {row.status === 'REJECTED' ? <span className="text-xs text-[#B3261E]">{t('requestRejected')}</span> : row.status === 'SUBMITTED' ? <span className="text-xs text-ink-soft">{t('requestAwaiting')}</span> : null}
                  </div>
                  {row.status === 'APPROVED' && row.investmentId ? (
                    <Link href={`/portal/receipts/${row.investmentId}`}>{t('viewReceipt')}</Link>
                  ) : null}
                </CardHead>
                <div className="grid gap-3 p-5 md:grid-cols-2">
                  <div><div className="text-sm text-ink-soft">{row.kind === 'PAYMENT' ? t('kindPayment') : t('shares')}</div><div className="num">{row.kind === 'PAYMENT' ? (row.targetInvestmentUid ?? '—') : row.shares}</div></div>
                  <div><div className="text-sm text-ink-soft">{t('amount')}</div><Money value={row.amount} /></div>
                  <div><div className="text-sm text-ink-soft">{t('method')}</div><div>{methodT(row.depositMethod)}</div></div>
                  <div><div className="text-sm text-ink-soft">{t('date')}</div><div>{row.depositDate.toISOString().slice(0, 10)}</div></div>
                  {row.status === 'REJECTED' && row.reviewNote ? (
                    <div className="md:col-span-2"><div className="text-sm text-ink-soft">{t('requestRejectReason')}</div><p className="text-sm text-[#B3261E]">{row.reviewNote}</p></div>
                  ) : null}
                  {row.status === 'SUBMITTED' && row.entrepreneurRequested ? (
                    <div className="md:col-span-2 text-xs text-ink-soft">{t('requestEntrepreneur')}</div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {rows.length === 0 ? null : (
        <section className="space-y-3">
          <h2 className="font-display text-[22px] font-bold leading-tight">{t('title')}</h2>
          <div className="space-y-4">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardHead className="justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num">{row.uid}</span>
                    <CategoryBadge category={row.category} />
                    <StatusBadge status={row.status} />
                  </div>
                  <Link href={`/portal/receipts/${row.id}`}>{t('viewReceipt')}</Link>
                </CardHead>
                <div className="grid gap-3 p-5 md:grid-cols-2">
                  <div><div className="text-sm text-ink-soft">{t('code')}</div><div className="num">{row.code}</div></div>
                  <div><div className="text-sm text-ink-soft">{t('shares')}</div><div className="num">{row.shares}</div></div>
                  <div><div className="text-sm text-ink-soft">{t('amount')}</div><Money value={row.amount} /></div>
                  <div>{row.incentiveAmount ? <><div className="text-sm text-ink-soft">{t('incentive')}</div><Money value={row.incentiveAmount} /></> : null}</div>
                  <div><div className="text-sm text-ink-soft">{t('date')}</div><div>{row.depositDate.toISOString().slice(0, 10)}</div></div>
                  <div><div className="text-sm text-ink-soft">{t('method')}</div><div>{methodT(row.depositMethod)}</div></div>
                  {row.confirmedAt ? <div><div className="text-sm text-ink-soft">{t('confirmedOn')}</div><div>{row.confirmedAt.toISOString().slice(0, 10)}</div></div> : null}
                  <div>{row.status === 'PENDING' ? <ConfirmButton investmentId={row.id} /> : null}</div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
