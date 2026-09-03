import { Link } from '@/i18n/navigation';
import * as React from 'react';
import { getTranslations, getLocale } from 'next-intl/server';
import { Button, buttonClasses } from '@/components/ui/Button';
import { DocumentModal } from '@/components/receipt/DocumentModal';
import { Card, CardHead } from '@/components/ui/Card';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { Money } from '@/components/ui/Money';
import { Num } from '@/components/ui/Num';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { KistiStatusBadge } from '@/components/ui/KistiStatusBadge';
import type { InvestmentListResult } from '@/lib/queries';
import type { ListInvestmentsInput } from '@/lib/validation';

function hrefWithParams(base: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export async function ShareholderTable({ result, query }: { result: InvestmentListResult; query: ListInvestmentsInput }) {
  const t = await getTranslations('admin');
  const methodT = await getTranslations('methods');
  const tPortal = await getTranslations('portal');
  const locale = await getLocale();
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
              <option value="GOLDEN_DIRECTOR">{t('categoryGoldenDirector')}</option>
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
                const rowBorder = ['px-4 py-3 border-b border-line text-sm align-middle', last && row.paymentPlan !== 'INSTALLMENT' ? 'border-b-0' : ''].join(' ');
                return (
                  <React.Fragment key={row.id}>
                  <tr className="hover:bg-honey-soft/50">
                    <td className={`num ${rowBorder}`}>{row.uid}</td>
                    <td className={rowBorder}>
                      <div className="font-semibold">
                        <Link href={`/admin/investors/${row.investorId}`} className="hover:underline" aria-label={t('rowDetail', { name: row.investorName })}>
                          {row.investorName}
                        </Link>
                      </div>
                      <div className="text-xs text-ink-soft num">{row.investorPhone}</div>
                    </td>
                    <td className={rowBorder}><CategoryBadge category={row.category} /></td>
                    <td className={rowBorder}><Num value={row.shares} /></td>
                    <td className={rowBorder}>
                      <Money value={row.amount} />
                      {row.paymentPlan === 'INSTALLMENT' ? (
                        <div className="text-xs font-semibold text-violet">{t('planInstallment')}</div>
                      ) : null}
                    </td>
                    <td className={rowBorder}>
                      <div>{row.depositDate.toISOString().slice(0, 10)}</div>
                      <div className="text-xs text-ink-soft">{methodT(row.depositMethod)}</div>
                    </td>
                    <td className={rowBorder}><StatusBadge status={row.status} /></td>
                    <td className={`${rowBorder} text-right whitespace-nowrap`}>
                      {/* No delete action: the ledger is append-only and the old client-side destroy button must not return. */}
                      <div className="inline-flex gap-2">
                        <DocumentModal title={`${tPortal('receiptModalTitle')} · ${row.uid}`} iframeSrc={`/${locale}/admin/receipts/${row.id}`} downloadHref={`/api/investments/${row.id}/receipt`} downloadLabel={tPortal('receiptDownload')} triggerLabel={t('rowReceipt')} triggerClassName={buttonClasses('default', 'sm')} />
                        <Link className={buttonClasses('default', 'sm')} href={`/admin/receipts/${row.id}?qr=1`}>{t('rowQr')}</Link>
                      </div>
                    </td>
                  </tr>
                  {row.paymentPlan === 'INSTALLMENT' && row.kistis.length > 0 ? (
                    <tr className="bg-paper/60">
                      <td colSpan={8} className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}>
                        <details>
                          <summary className="cursor-pointer text-xs font-semibold text-honey-deep">
                            {t('kistiToggle', { uid: row.uid })}
                          </summary>
                          <div className="mt-2 overflow-x-auto">
                            <table className="w-full min-w-[520px] border-collapse text-xs">
                              <thead>
                                <tr className="text-left">
                                  <th scope="col" className="py-1.5 pr-4 font-mono uppercase tracking-[0.1em] text-ink-soft">{t('colKistiId')}</th>
                                  <th scope="col" className="py-1.5 pr-4 font-mono uppercase tracking-[0.1em] text-ink-soft">{t('kistiAmountCol')}</th>
                                  <th scope="col" className="py-1.5 pr-4 font-mono uppercase tracking-[0.1em] text-ink-soft">{t('kistiDueCol')}</th>
                                  <th scope="col" className="py-1.5 font-mono uppercase tracking-[0.1em] text-ink-soft">{t('kistiStatusCol')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.kistis.map((k) => (
                                  <tr key={k.installmentNo} className="border-t border-line">
                                    <td className="num py-1.5 pr-4">{`${row.uid}-K${k.installmentNo}`}</td>
                                    <td className="py-1.5 pr-4"><Money value={k.amount} /></td>
                                    <td className="num py-1.5 pr-4">{k.dueDate.toISOString().slice(0, 10)}</td>
                                    <td className="py-1.5"><KistiStatusBadge status={k.status as 'SCHEDULED' | 'PAID' | 'OVERDUE' | 'CANCELLED'} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ) : null}
                  </React.Fragment>
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
