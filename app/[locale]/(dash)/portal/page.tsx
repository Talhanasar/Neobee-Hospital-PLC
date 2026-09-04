export const dynamic = 'force-dynamic';

import { Link, redirect } from '@/i18n/navigation';
import { requireInvestor, getSessionContext } from '@/lib/auth';
import { listInvestmentsForInvestor, listRequestsForInvestor, listSchedulesForInvestor } from '@/lib/queries';
import { Card, CardHead } from '@/components/ui/Card';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { InvestorBadge } from '@/components/ui/InvestorBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Money } from '@/components/ui/Money';
import { buttonClasses } from '@/components/ui/Button';
import { getTranslations } from 'next-intl/server';
import { kistiRef } from '@/lib/money';
import { KistiStatusBadge } from '@/components/ui/KistiStatusBadge';
import { DocumentModal } from '@/components/receipt/DocumentModal';

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
  const [rows, requests, schedules] = await Promise.all([
    listInvestmentsForInvestor(investor.id),
    listRequestsForInvestor(investor.id),
    listSchedulesForInvestor(investor.id),
  ]);
  const confirmedShares = rows.filter((row) => row.status === 'CONFIRMED').reduce((sum, row) => sum + row.shares, 0);
  const hasContent = rows.length > 0 || requests.length > 0;

  // Next-kisti alert: first unpaid schedule row across all investments, soonest due first.
  const nextKisti = rows
    .flatMap((row) => (schedules.get(row.id) ?? []).map((s) => ({ row, s })))
    .filter(({ s }) => s.status === 'SCHEDULED' || s.status === 'OVERDUE')
    .sort((a, b) => a.s.dueDate.getTime() - b.s.dueDate.getTime())[0] ?? null;
  const kistisLeft = rows
    .flatMap((row) => schedules.get(row.id) ?? [])
    .filter((s) => s.status === 'SCHEDULED' || s.status === 'OVERDUE').length;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="nb-kicker flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 bg-honey hex-clip" />
            {t('kicker')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t('greeting', { name: investor.name })}</h1><InvestorBadge shares={confirmedShares} /></div>
        </div>
        <div className="nb-card px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">{t('phoneChip')}</p>
          <span className="num mt-0.5 block text-sm font-semibold text-ink">{investor.phone}</span>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/portal/invest/new" className={buttonClasses('primary')}>{t('requestSubmit')}</Link>
        <Link href="/portal/certificates" className={buttonClasses('default')}>{t('certificates')}</Link>
        <Link href="/portal/account" className={buttonClasses('default')}>{t('accountDetails')}</Link>
        <Link href="/portal/password" className={buttonClasses('default')}>{t('changePassword')}</Link>
      </div>

      {nextKisti ? (
        <div role="status" className="rounded-card border border-honey/40 bg-honey-soft/50 px-4 py-3.5">
          <p className="text-sm font-semibold text-ink">
            {t('kistiAlert', { count: kistisLeft, uid: nextKisti.row.uid, kisti: nextKisti.s.installmentNo })}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {t('kistiAlertDue', {
              date: nextKisti.s.dueDate.toISOString().slice(0, 10),
              amount: nextKisti.s.amount.toLocaleString('en-IN'),
            })}
          </p>
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
                    <DocumentModal title={`${t('receiptModalTitle')} · ${row.targetInvestmentUid ?? row.investmentId}`} iframeSrc={`/${locale}/receipts/${row.investmentId}`} downloadHref={`/api/investments/${row.investmentId}/receipt`} downloadLabel={t('receiptDownload')} triggerLabel={t('viewReceipt')} />
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
            {rows.map((row) => {
              const schedule = schedules.get(row.id) ?? [];
              const paid = schedule.filter((s) => s.status === 'PAID').length;
              return (
                <Card key={row.id}>
                  <CardHead className="justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num">{row.uid}</span>
                      <CategoryBadge category={row.category} />
                      {row.paymentPlan === 'INSTALLMENT' && schedule.length > 0 ? (
                        <span className="text-xs font-semibold text-ink-soft">
                          {t('kistiProgress', { paid, total: schedule.length })}
                        </span>
                      ) : null}
                      <StatusBadge status={row.status} />
                    </div>
                    <DocumentModal title={`${t('receiptModalTitle')} · ${row.uid}`} iframeSrc={`/${locale}/receipts/${row.id}`} downloadHref={`/api/investments/${row.id}/receipt`} downloadLabel={t('receiptDownload')} triggerLabel={t('viewReceipt')} />
                  </CardHead>
                  <div className="grid gap-3 p-5 md:grid-cols-2">
                    <div><div className="text-sm text-ink-soft">{t('code')}</div><div className="num">{row.code}</div></div>
                    <div><div className="text-sm text-ink-soft">{t('shares')}</div><div className="num">{row.shares}</div></div>
                    <div><div className="text-sm text-ink-soft">{t('amountPaid')}</div><Money value={row.amount} /></div>
                    {row.paymentPlan === 'INSTALLMENT' ? (
                      <div><div className="text-sm text-ink-soft">{t('amountTotal')}</div><Money value={row.totalAmount} /></div>
                    ) : null}
                    <div><div className="text-sm text-ink-soft">{t('date')}</div><div>{row.depositDate.toISOString().slice(0, 10)}</div></div>
                    <div><div className="text-sm text-ink-soft">{t('method')}</div><div>{methodT(row.depositMethod)}</div></div>
                    {row.confirmedAt ? <div><div className="text-sm text-ink-soft">{t('confirmedOn')}</div><div>{row.confirmedAt.toISOString().slice(0, 10)}</div></div> : null}
                  </div>
                  {row.paymentPlan === 'INSTALLMENT' && schedule.length > 0 ? (
                    <details className="border-t border-line">
                      <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-honey-deep hover:bg-honey-soft/40">
                        {t('kistiToggle')}
                      </summary>
                      <div className="overflow-x-auto px-5 pb-5">
                        <table className="w-full border-collapse text-sm">
                          <caption className="sr-only">{t('kistiTableCaption')}</caption>
                          <thead>
                            <tr className="text-left">
                              <th scope="col" className="py-2 pr-4 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{t('kistiId')}</th>
                              <th scope="col" className="py-2 pr-4 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{t('kistiAmount')}</th>
                              <th scope="col" className="py-2 pr-4 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{t('kistiDue')}</th>
                              <th scope="col" className="py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{t('kistiStatus')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.map((s) => (
                              <tr key={s.id} className="border-t border-line">
                                <td className="py-2.5 pr-4 font-mono num">{kistiRef(row.uid, s.installmentNo)}</td>
                                <td className="py-2.5 pr-4"><Money value={s.amount} /></td>
                                <td className="py-2.5 pr-4 num">{s.dueDate.toISOString().slice(0, 10)}</td>
                                <td className="py-2.5"><KistiStatusBadge status={s.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <Link href="/portal/invest" className="mt-4 inline-block text-sm font-semibold text-honey-deep underline underline-offset-4">
                          {t('kistiAddPayment')}
                        </Link>                      </div>
                    </details>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
