export const dynamic = 'force-dynamic';

import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getRequestForReview } from '@/lib/queries';
import { ReviewRequestForm } from '@/components/admin/ReviewRequestForm';
import { PaymentRequestReview } from '@/components/admin/PaymentRequestReview';
import { Money } from '@/components/ui/Money';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getTranslations } from 'next-intl/server';
import { deriveCategory } from '@/lib/money';

export default async function AdminRequestDetailPage(
  { params }: { params: Promise<{ locale: string; id: string }> }
) {
  const { locale, id } = await params;
  await requireStaff();
  const t = await getTranslations({ locale, namespace: 'admin' });
  const methodT = await getTranslations({ locale, namespace: 'methods' });

  const [request, settings] = await Promise.all([
    getRequestForReview(id),
    getSettings(),
  ]);

  if (!request) notFound();

  const currentSharePrice = settings.SHARE_PRICE;
  const currentIncentivePerShare = settings.INCENTIVE_PER_SHARE;
  const priceChanged = request.sharePrice !== currentSharePrice;
  const incentiveChanged = request.incentivePerShare !== currentIncentivePerShare;
  const priceDiffers = priceChanged || incentiveChanged;

  const category = deriveCategory(request.shares);
  const isSubmitted = request.status === 'SUBMITTED';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-bold">{t('requestDetailTitle', { id: id.slice(0, 8) })}</h2>
          <p className="text-ink-soft">{t('requestDetailLead')}</p>
        </div>
        <Link href="/admin/requests" className="inline-flex items-center justify-center border border-line bg-panel rounded-lg font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2 px-3 py-[7px] text-[13px]">
          {t('backToQueue')}
        </Link>
      </div>

      {request.kind === 'PAYMENT' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <section className="bg-panel border border-line rounded-card p-4">
              <h3 className="font-semibold text-ink mb-3">{t('sectionInvestor')}</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t('colInvestor')}</dt>
                  <dd className="font-semibold">{request.investorName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t('colPhone')}</dt>
                  <dd className="font-mono text-ink">{request.investorPhone}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t('colInvestorId')}</dt>
                  <dd className="font-mono text-ink">{request.investorId}</dd>
                </div>
              </dl>
            </section>

            <section className="bg-panel border border-line rounded-card p-4">
              <h3 className="font-semibold text-ink mb-3">{t('paymentSectionTitle')}</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t('paymentTargetInvestment')}</dt>
                  <dd className="font-mono font-semibold">{request.targetInvestmentUid ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t('colAmount')}</dt>
                  <dd className="font-semibold"><Money value={request.amount} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t('colDepositMethod')}</dt>
                  <dd className="font-semibold">{methodT(request.depositMethod)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t('colDepositRef')}</dt>
                  <dd className="font-mono text-ink">{request.depositRef ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t('colDepositDate')}</dt>
                  <dd className="font-semibold">{request.depositDate.toISOString().slice(0, 10)}</dd>
                </div>
              </dl>
            </section>

            <section className="bg-panel border border-line rounded-card p-4">
              <h3 className="font-semibold text-ink mb-3">{t('sectionInvestorNote')}</h3>
              <p className="text-ink-soft whitespace-pre-wrap text-sm">{request.note ?? t('noNote')}</p>
            </section>
          </div>

          <div className="rounded-card border border-line bg-honey-soft/60 px-4 py-3 text-sm text-ink">
            {t('paymentApproveExplain')}
          </div>

          {isSubmitted ? (
            <PaymentRequestReview requestId={request.id} />
          ) : (
            <div className="bg-panel border border-line rounded-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={request.status === 'APPROVED' ? 'CONFIRMED' : 'PENDING'} />
                <span className="text-sm text-ink-soft">
                  {request.status === 'APPROVED' ? t('statusApproved') : t('statusRejected')}
                </span>
              </div>
              <dl className="grid gap-3 md:grid-cols-2 text-sm">
                <div>
                  <dt className="text-ink-soft">{t('colReviewedBy')}</dt>
                  <dd className="font-semibold">{request.reviewedByName ?? t('unknown')}</dd>
                </div>
                <div>
                  <dt className="text-ink-soft">{t('colReviewedAt')}</dt>
                  <dd className="font-semibold">{request.reviewedAt?.toISOString().slice(0, 16).replace('T', ' ') ?? '—'}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-ink-soft">{t('colReviewNote')}</dt>
                  <dd className="font-semibold whitespace-pre-wrap">{request.reviewNote ?? t('noReviewNote')}</dd>
                </div>
              </dl>
            </div>
          )}
        </>
      ) : (
      <>
      {priceDiffers && (
        <div className="bg-amber-soft border border-amber rounded-card px-4 py-3" role="alert">
          <p className="font-semibold text-ink">{t('priceSnapshotWarningTitle')}</p>
          <p className="mt-1 text-ink">{t('priceSnapshotWarningBody', { 
            snapshotSharePrice: request.sharePrice.toLocaleString('en-IN'), 
            currentSharePrice: currentSharePrice.toLocaleString('en-IN'),
            snapshotIncentivePerShare: request.incentivePerShare.toLocaleString('en-IN'),
            currentIncentivePerShare: currentIncentivePerShare.toLocaleString('en-IN'),
          })}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <section className="bg-panel border border-line rounded-card p-4">
          <h3 className="font-semibold text-ink mb-3">{t('sectionInvestor')}</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">{t('colInvestor')}</dt>
              <dd className="font-semibold">{request.investorName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{t('colPhone')}</dt>
              <dd className="font-mono text-ink">{request.investorPhone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{t('colInvestorId')}</dt>
              <dd className="font-mono text-ink">{request.investorId}</dd>
            </div>
          </dl>
        </section>

        <section className="bg-panel border border-line rounded-card p-4">
          <h3 className="font-semibold text-ink mb-3">{t('sectionSubscription')}</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">{t('colShares')}</dt>
              <dd className="font-semibold">{request.shares}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{t('colEntrepreneurRequested')}</dt>
              <dd className="font-semibold">
                {request.entrepreneurRequested ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-blue-soft text-blue">
                    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
                    {t('entrepreneurRequestedBadge')}
                  </span>
                ) : (
                  <span className="text-ink-soft">{t('no')}</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{t('colCategory')}</dt>
              <dd><CategoryBadge category={category} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{t('colAmount')}</dt>
              <dd><Money value={request.amount} /></dd>
            </div>
          </dl>
        </section>

        <section className="bg-panel border border-line rounded-card p-4">
          <h3 className="font-semibold text-ink mb-3">{t('sectionSnapshot')}</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">{t('colSharePrice')}</dt>
              <dd className="font-semibold"><Money value={request.sharePrice} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{t('colIncentivePerShare')}</dt>
              <dd className="font-semibold"><Money value={request.incentivePerShare} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{t('colDepositMethod')}</dt>
              <dd className="font-semibold">{methodT(request.depositMethod)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{t('colDepositRef')}</dt>
              <dd className="font-mono text-ink">{request.depositRef ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{t('colDepositDate')}</dt>
              <dd className="font-semibold">{request.depositDate.toISOString().slice(0, 10)}</dd>
            </div>
          </dl>
        </section>

        <section className="bg-panel border border-line rounded-card p-4 md:col-span-2 lg:col-span-3">
          <h3 className="font-semibold text-ink mb-3">{t('sectionInvestorNote')}</h3>
          <p className="text-ink-soft whitespace-pre-wrap">{request.note ?? t('noNote')}</p>
        </section>
      </div>

      {isSubmitted ? (
        <ReviewRequestForm 
          request={request} 
          sharePrice={request.sharePrice} 
          incentivePerShare={request.incentivePerShare} 
        />
      ) : (
        <div className="bg-panel border border-line rounded-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={request.status === 'APPROVED' ? 'CONFIRMED' : 'PENDING'} />
            <span className="text-sm text-ink-soft">
              {request.status === 'APPROVED' ? t('statusApproved') : t('statusRejected')}
            </span>
          </div>
          <dl className="grid gap-3 md:grid-cols-2 text-sm">
            <div>
              <dt className="text-ink-soft">{t('colReviewedBy')}</dt>
              <dd className="font-semibold">{request.reviewedByName ?? t('unknown')}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">{t('colReviewedAt')}</dt>
              <dd className="font-semibold">{request.reviewedAt?.toISOString().slice(0, 16).replace('T', ' ') ?? '—'}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-ink-soft">{t('colReviewNote')}</dt>
              <dd className="font-semibold whitespace-pre-wrap">{request.reviewNote ?? t('noReviewNote')}</dd>
            </div>
            {request.investmentId ? (
              <div className="md:col-span-2">
                <dt className="text-ink-soft">{t('colCreatedInvestment')}</dt>
                <dd>
                  <Link 
                    href={`/admin/receipts/${request.investmentId}`}
                    className="text-ink underline hover:text-ink-soft"
                  >
                    {t('viewReceipt')}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      )}
      </>
      )}
    </div>
  );
}