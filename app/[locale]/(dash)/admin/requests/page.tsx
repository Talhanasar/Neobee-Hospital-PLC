export const dynamic = 'force-dynamic';

import { Link } from '@/i18n/navigation';
import { requireStaff } from '@/lib/auth';
import { listPendingRequests } from '@/lib/queries';
import { Money } from '@/components/ui/Money';
import { getTranslations } from 'next-intl/server';

export default async function AdminRequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireStaff();
  const t = await getTranslations({ locale, namespace: 'admin' });
  const methodT = await getTranslations({ locale, namespace: 'methods' });
  const requests = await listPendingRequests();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">{t('requestsTitle')}</h2>
        <p className="text-ink-soft">{t('requestsLead')}</p>
      </div>
      {requests.length === 0 ? (
        <div className="bg-panel border border-line rounded-card p-8 text-center">
          <h3 className="font-semibold text-ink">{t('requestsEmptyTitle')}</h3>
          <p className="mt-2 text-sm text-ink-soft">{t('requestsEmptyHint')}</p>
        </div>
      ) : (
        <div className="bg-panel border border-line rounded-card overflow-x-auto">
          <table className="w-full border-collapse md:min-w-0 min-w-[820px]">
            <caption className="sr-only">{t('requestsTableCaption')}</caption>
            <thead>
              <tr>
                <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colCreatedAt')}</th>
                <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colInvestor')}</th>
                <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colShares')}</th>
                <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colEntrepreneurRequested')}</th>
                <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colAmount')}</th>
                <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colDeposit')}</th>
                <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((row, index) => {
                const last = index === requests.length - 1;
                return (
                  <tr key={row.id} className="hover:bg-honey-soft/50">
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle num', last ? 'border-b-0' : ''].join(' ')}>
                      {row.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}>
                      <Link href={`/admin/requests/${row.id}`} className="font-semibold hover:underline">
                        {row.investorName}
                      </Link>
                      <div className="text-xs text-ink-soft num">{row.investorPhone}</div>
                    </td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}>
                      {row.kind === 'PAYMENT' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-violet-soft text-violet">
                          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
                          {t('kindPayment')}
                        </span>
                      ) : (
                        row.shares
                      )}
                    </td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}>
                      {row.entrepreneurRequested ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-blue-soft text-blue">
                          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
                          {t('entrepreneurRequestedBadge')}
                        </span>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}><Money value={row.amount} /></td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}>
                      <div>{row.depositDate.toISOString().slice(0, 10)}</div>
                      <div className="text-xs text-ink-soft">{methodT(row.depositMethod)}</div>
                      {row.depositRef ? <div className="text-xs text-ink-soft">{t('colDepositRef', { ref: row.depositRef })}</div> : null}
                    </td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle text-right whitespace-nowrap', last ? 'border-b-0' : ''].join(' ')}>
                      <Link href={`/admin/requests/${row.id}`} className={['inline-flex items-center justify-center border border-line bg-panel rounded-lg font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2 px-3 py-[7px] text-[13px]',].join(' ')}>
                        {t('colReview')}
                      </Link>
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