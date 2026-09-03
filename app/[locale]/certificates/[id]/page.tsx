export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Link, redirect } from '@/i18n/navigation';
import { AuthError, requireInvestor } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isDemoData, demoGetInvestorCertificate } from '@/data/demo/store';
import { renderQrDataUrl, verificationQrPayload } from '@/lib/qr';
import Certificate, { type CertificateData } from '@/components/receipt/Certificate';
import { PrintButton } from '@/components/receipt/PrintButton';
import { PrintOnMessage } from './PrintOnMessage';
import { getTranslations } from 'next-intl/server';
import { certRef, deriveCategory } from '@/lib/money';
import { getSettings } from '@/lib/settings';

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ embed?: string }> };

/**
 * Chrome-free certificate view (outside the dash groups, like /[locale]/receipts/[id])
 * so the DocumentModal iframe shows the document alone. ?embed=1 hides the
 * header row; the modal's own Print button drives printing via postMessage.
 *
 * {id} is the INVESTOR id — the certificate is a cumulative view of every
 * fully-paid holding for that investor. Half-paid kisti holdings never appear.
 */
export default async function CertificatePage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const { embed } = await searchParams;
  let investor;
  try {
    investor = await requireInvestor();
  } catch (error) {
    if (error instanceof AuthError) redirect({ href: '/login', locale });
    throw error;
  }
  // This page is investor-only; staff view certificates via the admin receipts.
  if (investor.id !== id) notFound();

  const settings = await getSettings();

  let data: CertificateData;

  if (isDemoData()) {
    const demo = demoGetInvestorCertificate(id);
    if (!demo) notFound();
    data = { ...demo, investorName: investor.name, sharePrice: settings.SHARE_PRICE };
  } else {
    const rows = await prisma.investment.findMany({
      where: { investorId: id, fullyPaidAt: { not: null } },
      orderBy: { fullyPaidAt: 'asc' },
      select: {
        uid: true,
        code: true,
        category: true,
        shares: true,
        sharePrice: true,
        amount: true,
        fullyPaidAt: true,
        certificate: { select: { issuedAt: true } },
      },
    });
    if (rows.length === 0) notFound();

    // The where-clause guarantees fullyPaidAt is set on every row.
    const holdings = rows.map((r) => ({
      uid: r.uid,
      shares: r.shares,
      amount: r.amount,
      paidAt: r.fullyPaidAt!,
    }));
    const totalShares = holdings.reduce((s, h) => s + h.shares, 0);
    const totalAmount = holdings.reduce((s, h) => s + h.amount, 0);
    const issuedAt = rows.reduce((min, r) => {
      const d = r.certificate?.issuedAt ?? r.fullyPaidAt!;
      return d < min ? d : min;
    }, rows[0].certificate?.issuedAt ?? rows[0].fullyPaidAt!);

    data = {
      certRef: certRef(rows[0].uid),
      code: rows[rows.length - 1].code,
      investorName: investor.name,
      category: deriveCategory(totalShares),
      shares: totalShares,
      sharePrice: settings.SHARE_PRICE,
      amount: totalAmount,
      issuedAt,
      holdings,
    };
  }

  const qrDataUrl = await renderQrDataUrl(verificationQrPayload({ code: data.code }));
  const t = await getTranslations('portal');
  const certT = await getTranslations({ locale: 'en', namespace: 'certificate' });
  return (
    <div className="min-h-dvh bg-paper p-4 sm:p-8 print:min-h-0 print:p-0">
      <PrintOnMessage />
      {embed !== '1' ? (
        <div className="no-print mb-4 flex items-center gap-3">
          <Link href="/portal/certificates">{t('back')}</Link>
          <PrintButton />
          {/* Direct PDF download — the print layout stays for on-paper use. */}
          <a
            href={`/api/investors/${id}/certificate`}
            className="inline-flex h-9 items-center rounded-lg bg-honey px-3.5 text-sm font-semibold text-white hover:bg-honey-deep"
            download
          >
            {certT('downloadPdf')}
          </a>
        </div>
      ) : null}
      <Certificate data={data} qrDataUrl={qrDataUrl} />
    </div>
  );
}
