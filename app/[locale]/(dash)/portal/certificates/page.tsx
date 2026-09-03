export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { DocumentModal } from '@/components/receipt/DocumentModal';
import { requireInvestor, getSessionContext } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isDemoData, demoListCertificatesForInvestor } from '@/data/demo/store';
import { Card, CardHead } from '@/components/ui/Card';
import { getTranslations } from 'next-intl/server';
import { certRef } from '@/lib/money';

type CertRow = {
  id: string;
  uid: string;
  category: 'SHAREHOLDER' | 'PREMIUM' | 'DIRECTOR' | 'GOLDEN_DIRECTOR';
  shares: number;
  amount: number;
  paymentPlan: 'FULL' | 'INSTALLMENT';
  fullyPaidAt: Date | null;
  certificate?: { issuedAt: Date } | null;
};

export default async function CertificatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSessionContext();
  if (!session.user) redirect({ href: '/login', locale });
  const t = await getTranslations({ locale, namespace: 'portal' });
  const certT = await getTranslations({ locale: 'en', namespace: 'certificate' });
  if (!session.isInvestor) redirect({ href: '/register', locale });

  const investor = await requireInvestor();

  // Fully-paid investments with their certificate issue date (if already issued).
  const rows: CertRow[] = isDemoData()
    ? (demoListCertificatesForInvestor(investor.id) as unknown as CertRow[]).map((r) => ({
        ...r,
        certificate: r.fullyPaidAt ? { issuedAt: r.fullyPaidAt } : null,
      }))
    : await prisma.investment.findMany({
        where: { investorId: investor.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          uid: true,
          category: true,
          shares: true,
          amount: true,
          paymentPlan: true,
          fullyPaidAt: true,
          certificate: { select: { issuedAt: true } },
        },
      });

  const complete = rows.filter((row) => row.fullyPaidAt !== null);
  const incomplete = rows.filter((row) => row.fullyPaidAt === null);

  // Cumulative certificate: aggregate every fully-paid holding into one card.
  // The cert number is stable (first/earliest holding's uid) as holdings grow;
  // half-paid kisti plans never appear here.
  let aggregate: { certRef: string; issuedAt: Date; shares: number; amount: number } | null = null;
  if (complete.length > 0) {
    const sorted = [...complete].sort((a, b) => {
      const da = a.certificate?.issuedAt ?? a.fullyPaidAt!;
      const db = b.certificate?.issuedAt ?? b.fullyPaidAt!;
      return da.getTime() - db.getTime();
    });
    aggregate = {
      certRef: certRef(sorted[0].uid),
      issuedAt: sorted[0].certificate?.issuedAt ?? sorted[0].fullyPaidAt!,
      shares: complete.reduce((s, r) => s + r.shares, 0),
      amount: complete.reduce((s, r) => s + r.amount, 0),
    };
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t('certificatesTitle')}</h1>
        <p className="text-sm leading-relaxed text-ink-soft">{t('certificatesLead')}</p>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-panel p-6">
          <h2 className="font-semibold">{t('requestEmpty')}</h2>
          <p className="mt-2 text-ink-soft">{t('requestEmptyHint')}</p>
        </div>
      ) : null}

      {aggregate ? (
        <section className="space-y-4">
          <Card>
            <CardHead className="justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num">{aggregate.certRef}</span>
              </div>
              <DocumentModal
                title={t('certificateModalTitle')}
                iframeSrc={`/${locale}/certificates/${investor.id}`}
                downloadHref={`/api/investors/${investor.id}/certificate`}
                downloadLabel={certT('downloadPdf')}
                triggerLabel={t('viewCertificate')}
                triggerClassName="text-sm font-semibold text-honey-deep underline underline-offset-4"
              />
            </CardHead>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              <div><div className="text-sm text-ink-soft">{t('certNo')}</div><div className="num">{aggregate.certRef}</div></div>
              <div><div className="text-sm text-ink-soft">{t('certIssued')}</div><div className="num">{aggregate.issuedAt.toISOString().slice(0, 10)}</div></div>
              <div><div className="text-sm text-ink-soft">{t('shares')}</div><div className="num">{aggregate.shares}</div></div>
              <div><div className="text-sm text-ink-soft">{t('amountPaid')}</div><div className="num">৳{aggregate.amount.toLocaleString('en-IN')}</div></div>
            </div>
          </Card>
        </section>
      ) : null}

      {incomplete.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-[22px] font-bold leading-tight">{t('certificatesPendingTitle')}</h2>
          <div className="space-y-3">
            {incomplete.map((row) => (
              <div key={row.id} className="rounded-card border border-dashed border-line bg-paper px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="num text-sm font-semibold">{row.uid}</span>
                  <span className="text-xs font-semibold text-ink-soft">
                    {row.paymentPlan === 'INSTALLMENT' ? t('certIncompleteKisti') : t('certIncompletePending')}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-ink-soft">{t('certIncompleteBody')}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
