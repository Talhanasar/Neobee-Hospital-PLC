export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Link, redirect } from '@/i18n/navigation';
import { AuthError, assertOwnsInvestment, requireInvestor } from '@/lib/auth';
import { getReceiptData } from '@/lib/queries';
import { renderQrDataUrl, verificationQrPayload } from '@/lib/qr';
import Receipt from '@/components/receipt/Receipt';
import { QrModal } from '@/components/receipt/QrModal';
import { PrintButton } from '@/components/receipt/PrintButton';
import { PrintOnMessage } from './PrintOnMessage';
import { getTranslations } from 'next-intl/server';

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ kisti?: string; embed?: string }> };

export default async function ReceiptPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const { kisti, embed } = await searchParams;
  const installmentNo = kisti != null && kisti !== '' && Number.isInteger(Number(kisti)) ? Number(kisti) : undefined;
  let investor;
  try { investor = await requireInvestor(); } catch (error) { if (error instanceof AuthError) redirect({ href: '/login', locale }); throw error; }
  try { await assertOwnsInvestment(investor.id, id); } catch (error) { if (error instanceof AuthError) notFound(); throw error; }
  const data = await getReceiptData(id, { installmentNo }); if (!data) notFound();
  const qrDataUrl = await renderQrDataUrl(verificationQrPayload({ code: data.code }));
  const t = await getTranslations('portal');
  return (
    <div className="min-h-dvh bg-paper p-4 sm:p-8 print:min-h-0 print:p-0">
      <PrintOnMessage />
      {embed !== '1' ? (
        <div className="no-print mb-4 flex items-center justify-between gap-3">
          <Link href="/portal">{t('back')}</Link>
          <QrModal qrDataUrl={qrDataUrl} code={data.code} uid={data.uid} />
        </div>
      ) : null}
      <Receipt data={data} qrDataUrl={qrDataUrl} />
      {embed !== '1' ? (
        <div className="mt-4">
          <PrintButton />
        </div>
      ) : null}
    </div>
  );
}
