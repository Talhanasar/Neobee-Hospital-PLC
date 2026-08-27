import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card, CardHead } from '@/components/ui/Card';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { Money } from '@/components/ui/Money';
import { Num } from '@/components/ui/Num';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { InvestmentListResult } from '@/lib/queries';
import type { ListInvestmentsInput } from '@/lib/validation';

function hrefWithParams(base: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export async function ShareholderTable({ result, query }: { result: InvestmentListResult; query: ListInvestmentsInput }) {
  const t = await getTranslations('admin');
  const methodT = await getTranslations('methods');
  const hasFilters = Boolean(query.search || query.status || query.category);
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);

  return (
    <Card>
      <CardHead className="items-start md:items-center justify-between gap-4">
        <form method="get" className="flex w-full flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <span className="block text-[12.5px] font-semibold">{t('filterSearch')}</span>
            <input name="search" defaultValue={query.search ?? ''} placeholder={t('filterSearchPlaceholder')} className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 focus:outline-honey-deep border-honey" />
          </label>
          <label className="flex flex-col gap-1.5 md:w-[160px]">
            <span className="block text-[12.5px] font-semibold">{t('filterStatus')}</span>
            <select name="status" defaultValue={query.status ?? ''} className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 focus:outline-honey-deep border-honey">
              <option value="">{t('filterAll')}</option>
              <option value="PENDING">{t('statusPending')}</option>
              <option value="CONFIRMED">{t('statusConfirmed')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 md:w-[160px]">
            <span className="block text-[12.5px] font-semibold">{t('filterCategory')}</span>
            <select name="category" defaultValue={query.category ?? ''} className="w-full border border-line rounded-lg px-3 py-2.5 bg-paper focus:outline-2 focus:outline-honey-deep border-honey">
              <option value="">{t('filterAll')}</option>
              <option value="SHAREHOLDER">{t('categoryShareholder')}</option>
              <option value="PREMIUM">{t('categoryPremium')}</option>
              <option value="DIRECTOR">{t('categoryDirector')}</option>
            </select>
          </label>
          <input type="hidden" name="pageSize" value={query.pageSize} />
          <Button type="submit">{t('filterSubmit')}</Button>
        </form>
      </CardHead>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse md:min-w-0 min-w-[820px]">
          <caption className="sr-only">{t('tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colUid')}</th>
              <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colShareholder')}</th>
              <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colCategory')}</th>
              <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colShares')}</th>
              <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colAmount')}</th>
              <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colDeposit')}</th>
              <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colStatus')}</th>
              <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-ink-soft">
                  <h3 className="font-semibold text-ink">{hasFilters ? t('emptyFilteredTitle') : t('emptyTitle')}</h3>
                  <p className="mt-2 text-sm">{hasFilters ? t('emptyFilteredHint') : t('emptyHint')}</p>
                  {hasFilters ? <div className="mt-4"><Link href="/admin" className={buttonClasses('default', 'sm')}>{t('emptyClear')}</Link></div> : null}
                </td>
              </tr>
            ) : (
              result.items.map((row, index) => {
                const last = index === result.items.length - 1;
                return (
                  <tr key={row.id} className="hover:bg-honey-soft/50">
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle num', last ? 'border-b-0' : ''].join(' ')}>{row.uid}</td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}>
                      <div className="font-semibold">{row.investorName}</div>
                      <div className="text-xs text-ink-soft num">{row.investorPhone}</div>
                    </td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}><CategoryBadge category={row.category} /></td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}><Num value={row.shares} /></td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}><Money value={row.amount} /></td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}>
                      <div>{row.depositDate.toISOString().slice(0, 10)}</div>
                      <div className="text-xs text-ink-soft">{methodT(row.depositMethod)}</div>
                    </td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}><StatusBadge status={row.status} /></td>
                    <td className={['px-4 py-3 border-b border-line text-sm align-middle text-right whitespace-nowrap', last ? 'border-b-0' : ''].join(' ')}>
                      {/* No delete action: the ledger is append-only and the old client-side destroy button must not return. */}
                      <div className="inline-flex gap-2">
                        <Link className={buttonClasses('default', 'sm')} href={`/admin/receipts/${row.id}`}>{t('rowReceipt')}</Link>
                        <Link className={buttonClasses('default', 'sm')} href={`/admin/receipts/${row.id}?qr=1`}>{t('rowQr')}</Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            <tr>
              <td colSpan={8} className="px-4 py-3 border-t border-line text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-ink-soft">{t('paginationSummary', { from: from.toLocaleString('en-IN'), to: to.toLocaleString('en-IN'), total: result.total.toLocaleString('en-IN') })}</div>
                  <div className="flex gap-2">
                    {result.page > 1 ? <Link href={hrefWithParams('/admin', new URLSearchParams(Object.entries({ search: query.search ?? '', status: query.status ?? '', category: query.category ?? '', pageSize: String(query.pageSize), page: String(result.page - 1) }).filter(([, v]) => v)))} className={buttonClasses('default', 'sm')}>{t('previous')}</Link> : <span className="text-ink-soft">{t('previous')}</span>}
                    {result.page < result.totalPages ? <Link href={hrefWithParams('/admin', new URLSearchParams(Object.entries({ search: query.search ?? '', status: query.status ?? '', category: query.category ?? '', pageSize: String(query.pageSize), page: String(result.page + 1) }).filter(([, v]) => v)))} className={buttonClasses('default', 'sm')}>{t('next')}</Link> : <span className="text-ink-soft">{t('next')}</span>}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
