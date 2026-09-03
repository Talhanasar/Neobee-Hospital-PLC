export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { DocumentModal } from '@/components/receipt/DocumentModal';
import { requireInvestor, getSessionContext, AuthError } from '@/lib/auth';
import { listInvestmentsForInvestor, listSchedulesForInvestor } from '@/lib/queries';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { Money } from '@/components/ui/Money';
import { Num } from '@/components/ui/Num';
import { getTranslations } from 'next-intl/server';

type Props = { params: Promise<{ locale: string }> };

export default async function ReceiptsPage({ params }: Props) {
  const { locale } = await params;
  const session = await getSessionContext();
  if (!session.user) redirect({ href: '/login', locale });
  if (!session.isInvestor) redirect({ href: '/register', locale });
  const t = await getTranslations({ locale, namespace: 'portal' });

  let investor;
  try {
    investor = await requireInvestor();
  } catch (error) {
    if (error instanceof AuthError) redirect({ href: '/login', locale });
    throw error;
  }

  const [rows, schedules] = await Promise.all([
    listInvestmentsForInvestor(investor.id),
    listSchedulesForInvestor(investor.id),
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t('receiptsTitle')}</h1>
        <p className="text-sm leading-relaxed text-ink-soft">{t('receiptsLead')}</p>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-panel p-6">
          <h2 className="font-semibold">{t('requestEmpty')}</h2>
          <p className="mt-2 text-ink-soft">{t('requestEmptyHint')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-panel">
          <table className="w-full border-collapse md:min-w-0 min-w-[720px]">
            <caption className="sr-only">{t('receiptsTableCaption')}</caption>
            <thead>
              <tr>
                <th scope="col" className="whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{t('uid')}</th>
                <th scope="col" className="whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{t('shares')}</th>
                <th scope="col" className="whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{t('amountPaid')}</th>
                <th scope="col" className="whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{t('kistisPaid')}</th>
                <th scope="col" className="whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{t('colActionsInline')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const last = index === rows.length - 1;
                const rowBorder = ['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ');
                const schedule = schedules.get(row.id) ?? [];
                const paidCount = schedule.filter((s) => s.status === 'PAID').length;
                return (
                  <tr key={row.id} className="hover:bg-honey-soft/50">
                    <td className={`num ${rowBorder}`}>
                      <div className="font-semibold">{row.uid}</div>
                      <CategoryBadge category={row.category} />
                    </td>
                    <td className={rowBorder}><Num value={row.shares} /></td>
                    <td className={rowBorder}><Money value={row.amount} /></td>
                    <td className={rowBorder}>
                      {row.paymentPlan === 'INSTALLMENT' && schedule.length > 0 ? (
                        <span className="text-xs font-semibold text-violet">{t('kistiProgress', { paid: paidCount, total: schedule.length })}</span>
                      ) : (
                        <span className="text-xs text-ink-soft">—</span>
                      )}
                    </td>
                    <td className={`${rowBorder} whitespace-nowrap text-right`}>
                      <div className="inline-flex gap-2">
                        <a
                          href={`/api/investments/${row.id}/receipt`}
                          className="inline-flex h-8 items-center rounded-lg bg-honey px-3 text-[13px] font-semibold text-white hover:bg-honey-deep"
                          download
                        >
                          {t('receiptDownload')}
                        </a>
                        <DocumentModal title={`${t('receiptModalTitle')} · ${row.uid}`} iframeSrc={`/${locale}/receipts/${row.id}`} downloadHref={`/api/investments/${row.id}/receipt`} downloadLabel={t('receiptDownload')} triggerLabel={t('viewReceipt')} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
