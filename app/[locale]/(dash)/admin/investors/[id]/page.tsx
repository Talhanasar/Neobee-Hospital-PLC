export const dynamic = 'force-dynamic';

import { Link } from '@/i18n/navigation';
import * as React from 'react';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { getInvestorDetail } from '@/lib/queries';
import { Money } from '@/components/ui/Money';
import { Num } from '@/components/ui/Num';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { InvestorBadge } from '@/components/ui/InvestorBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { KistiStatusBadge } from '@/components/ui/KistiStatusBadge';
import { getTranslations } from 'next-intl/server';

export default async function AdminInvestorDetailPage(
  { params }: { params: Promise<{ locale: string; id: string }> },
) {
  const { locale, id } = await params;
  await requireStaff();
  const t = await getTranslations({ locale, namespace: 'admin' });
  const methodT = await getTranslations({ locale, namespace: 'methods' });

  const investor = await getInvestorDetail(id);
  if (!investor) notFound();

  const confirmed = investor.investments.filter((i) => i.status === 'CONFIRMED');
  const totalShares = confirmed.reduce((sum, i) => sum + i.shares, 0);
  const totalInvested = confirmed.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-2xl font-bold">{t('detailTitle', { name: investor.name })}</h2><InvestorBadge shares={totalShares} /></div>
          <p className="text-ink-soft">{t('detailLead')}</p>
        </div>
        <Link href="/admin" className="inline-flex items-center justify-center border border-line bg-panel rounded-lg font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2 px-3 py-[7px] text-[13px]">
          {t('back')}
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <section className="bg-panel border border-line rounded-card p-4">
          <h3 className="font-semibold text-ink mb-3">{t('detailSectionProfile')}</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{t('regName')}</dt>
              <dd className="font-semibold text-right">{investor.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{t('detailPhone')}</dt>
              <dd className="font-mono text-ink">{investor.phone}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{t('regEmail')}</dt>
              <dd className="font-semibold text-right">{investor.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{t('regNid')}</dt>
              <dd className="font-mono text-ink">{investor.nationalIdNumber ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{t('detailAddress')}</dt>
              <dd className="font-semibold text-right">{investor.address ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{t('detailMemberSince')}</dt>
              <dd className="font-semibold">{investor.createdAt.toISOString().slice(0, 10)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{t('regStatus')}</dt>
              <dd>
                {investor.approvalStatus === 'PENDING' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-[11px] font-semibold text-amber">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber" />
                    {t('regPending')}
                  </span>
                ) : (
                  <span className="rounded-full bg-green-soft px-2.5 py-1 text-[11px] font-semibold text-green">{t('regApproved')}</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="bg-panel border border-line rounded-card p-4">
          <h3 className="font-semibold text-ink mb-3">{t('detailSectionSummary')}</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{t('detailTotalShares')}</dt>
              <dd className="font-semibold"><Num value={totalShares} /></dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{t('detailTotalInvested')}</dt>
              <dd className="font-semibold"><Money value={totalInvested} /></dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-soft">{t('detailSummaryHint')}</p>
        </section>
      </div>

      <section className="bg-panel border border-line rounded-card overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h3 className="font-semibold text-ink">{t('detailInvestments')}</h3>
        </div>
        {investor.investments.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-soft">{t('detailNoInvestments')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse md:min-w-0 min-w-[760px]">
              <caption className="sr-only">{t('detailInvestments')}</caption>
              <thead>
                <tr>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colUid')}</th>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colPaymentPlan')}</th>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colShares')}</th>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colAmount')}</th>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colCategory')}</th>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colDeposit')}</th>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colStatus')}</th>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colCertificate')}</th>
                </tr>
              </thead>
              <tbody>
                {investor.investments.map((inv, index) => {
                  const last = index === investor.investments.length - 1;
                  const rowBorder = ['px-4 py-3 border-b border-line text-sm align-middle', last && inv.paymentPlan !== 'INSTALLMENT' ? 'border-b-0' : ''].join(' ');
                  return (
                    <React.Fragment key={inv.id}>
                      <tr className="hover:bg-honey-soft/50">
                        <td className={`num ${rowBorder}`}>
                          <div>{inv.uid}</div>
                          {inv.paymentGroup ? (
                            <div className="mt-0.5 text-[11px] leading-tight text-ink-soft">
                              <span className="font-mono">{inv.paymentGroup.ref}</span>
                              {' · '}
                              {inv.paymentGroup.kind === 'KISTI' ? t('groupKindKisti') : t('groupKindInstant')}
                              {' · '}
                              {t('groupShareCount', { count: inv.paymentGroup.shareCount })}
                            </div>
                          ) : null}
                        </td>
                        <td className={rowBorder}>
                          {inv.paymentPlan === 'INSTALLMENT' ? t('planInstallment') : t('planFull')}
                        </td>
                        <td className={rowBorder}><Num value={inv.shares} /></td>
                        <td className={rowBorder}><Money value={inv.amount} /></td>
                        <td className={rowBorder}><CategoryBadge category={inv.category} /></td>
                        <td className={rowBorder}>
                          <div>{inv.depositDate.toISOString().slice(0, 10)}</div>
                          <div className="text-xs text-ink-soft">{methodT(inv.depositMethod)}</div>
                        </td>
                        <td className={rowBorder}><StatusBadge status={inv.status} /></td>
                        <td className={rowBorder}>{inv.certificateRef ?? '—'}</td>
                      </tr>
                      {inv.paymentPlan === 'INSTALLMENT' && inv.kistis.length > 0 ? (
                        <tr className="bg-paper/60">
                          <td colSpan={8} className={['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ')}>
                            <details>
                              <summary className="cursor-pointer text-xs font-semibold text-honey-deep">
                                {t('kistiToggle', { uid: inv.uid })}
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
                                    {inv.kistis.map((k) => (
                                      <tr key={k.installmentNo} className="border-t border-line">
                                        <td className="num py-1.5 pr-4">{`${inv.uid}-K${k.installmentNo}`}</td>
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-panel border border-line rounded-card overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h3 className="font-semibold text-ink">{t('detailRequests')}</h3>
        </div>
        {investor.requests.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-soft">{t('detailNoRequests')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse md:min-w-0 min-w-[640px]">
              <caption className="sr-only">{t('detailRequests')}</caption>
              <thead>
                <tr>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colCreatedAt')}</th>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('detailKind')}</th>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colShares')}</th>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colAmount')}</th>
                  <th scope="col" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-soft text-left px-4 py-3 border-b border-line bg-paper whitespace-nowrap">{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {investor.requests.map((req, index) => {
                  const last = index === investor.requests.length - 1;
                  const rowBorder = ['px-4 py-3 border-b border-line text-sm align-middle', last ? 'border-b-0' : ''].join(' ');
                  return (
                    <tr key={req.id} className="hover:bg-honey-soft/50">
                      <td className={`num ${rowBorder}`}>{req.createdAt.toISOString().slice(0, 10)}</td>
                      <td className={rowBorder}>{req.kind === 'PAYMENT' ? t('kindPayment') : t('kindShare')}</td>
                      <td className={rowBorder}>{req.kind === 'PAYMENT' ? '—' : <Num value={req.shares} />}</td>
                      <td className={rowBorder}><Money value={req.amount} /></td>
                      <td className={rowBorder}>
                        {req.status === 'APPROVED' ? (
                          <span className="rounded-full bg-green-soft px-2.5 py-1 text-[11px] font-semibold text-green">{t('statusApproved')}</span>
                        ) : req.status === 'REJECTED' ? (
                          <span className="rounded-full bg-amber-soft px-2.5 py-1 text-[11px] font-semibold text-amber">{t('statusRejected')}</span>
                        ) : (
                          <span className="rounded-full bg-amber-soft px-2.5 py-1 text-[11px] font-semibold text-amber">{t('statusPending')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
