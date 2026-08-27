export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Link, redirect } from '@/i18n/navigation';
import { AuthError, assertOwnsInvestment, requireInvestor } from '@/lib/auth';
import { getReceiptData } from '@/lib/queries';
import { renderQrDataUrl, verificationQrPayload } from '@/lib/qr';
import Receipt from '@/components/receipt/Receipt';
import { QrModal } from '@/components/receipt/QrModal';
import { PrintButton } from '@/components/receipt/PrintButton';
import { getTranslations } from 'next-intl/server';

export default async function ReceiptPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  let investor;
  try { investor = await requireInvestor(); } catch (error) { if (error instanceof AuthError) redirect({ href: '/login', locale }); throw error; }
  try { await assertOwnsInvestment(investor.id, id); } catch (error) { if (error instanceof AuthError) notFound(); throw error; }
  const data = await getReceiptData(id); if (!data) notFound();
  const qrDataUrl = await renderQrDataUrl(verificationQrPayload({ code: data.code, uid: data.uid, shares: data.shares, amount: data.amount }));
  const t = await getTranslations('portal');
  return <div className="space-y-4"><div className="no-print flex gap-3"><Link href="/portal">{t('back')}</Link><QrModal qrDataUrl={qrDataUrl} code={data.code} uid={data.uid} /><PrintButton /></div><Receipt data={data} qrDataUrl={qrDataUrl} /></div>;
}
