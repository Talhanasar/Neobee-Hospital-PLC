export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Link, redirect } from '@/i18n/navigation';
import { AuthError, assertOwnsInvestment, requireInvestor } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isDemoData, demoGetCertificate } from '@/data/demo/store';
import { renderQrDataUrl, verificationQrPayload } from '@/lib/qr';
import Certificate from '@/components/receipt/Certificate';
import { PrintButton } from '@/components/receipt/PrintButton';
import { getTranslations } from 'next-intl/server';

export default async function CertificatePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  let investor;
  try { investor = await requireInvestor(); } catch (error) { if (error instanceof AuthError) redirect({ href: '/login', locale }); throw error; }
  try { await assertOwnsInvestment(investor.id, id); } catch (error) { if (error instanceof AuthError) notFound(); throw error; }

  // Only fully-paid investments have a certificate; anything else 404s here.
  const row = isDemoData()
    ? demoGetCertificate(id)
    : await prisma.investment.findFirst({
        where: { id, investorId: investor.id, fullyPaidAt: { not: null } },
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
  if (!row) notFound();

  const data = {
    uid: row.uid,
    code: row.code,
    investorName: investor.name,
    category: row.category,
    shares: row.shares,
    sharePrice: row.sharePrice,
    amount: row.amount,
    issuedAt: isDemoData()
      ? (row as { issuedAt: Date }).issuedAt
      : ((row as { certificate?: { issuedAt: Date } | null }).certificate?.issuedAt ?? (row as { fullyPaidAt: Date }).fullyPaidAt),
  };
  const qrDataUrl = await renderQrDataUrl(verificationQrPayload({ code: data.code, uid: data.uid, shares: data.shares, amount: data.amount }));
  const t = await getTranslations('portal');
  const certT = await getTranslations({ locale: 'en', namespace: 'certificate' });
  return (
    <div className="space-y-4">
      <div className="no-print flex gap-3">
        <Link href="/portal/certificates">{t('back')}</Link>
        <PrintButton />
        {/* Direct PDF download — the print layout stays for on-paper use. */}
        <a
          href={`/api/investments/${id}/certificate`}
          className="inline-flex h-9 items-center rounded-lg bg-honey px-3.5 text-sm font-semibold text-ink hover:bg-honey-deep"
          download
        >
          {certT('downloadPdf')}
        </a>
      </div>
      <Certificate data={data} qrDataUrl={qrDataUrl} />
    </div>
  );
}
