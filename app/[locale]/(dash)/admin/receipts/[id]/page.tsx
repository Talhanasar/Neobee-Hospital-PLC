export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Link, redirect } from '@/i18n/navigation';
import { AuthError, requireStaff } from '@/lib/auth';
import { getReceiptData } from '@/lib/queries';
import { renderQrDataUrl, verificationQrPayload } from '@/lib/qr';
import { QrModal } from '@/components/receipt/QrModal';
import Receipt from '@/components/receipt/Receipt';
import { PrintButton } from '@/components/receipt/PrintButton';
import { getTranslations } from 'next-intl/server';

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale, id } = await params;
  const sp = await searchParams;
  try { await requireStaff(); } catch (error) { if (error instanceof AuthError) redirect({ href: '/login', locale }); throw error; }
  const data = await getReceiptData(id);
  if (!data) notFound();
  const qrDataUrl = await renderQrDataUrl(verificationQrPayload({ code: data.code, uid: data.uid, shares: data.shares, amount: data.amount }));
  const t = await getTranslations('admin');
  return <div className="space-y-4"><div className="no-print flex flex-wrap gap-2"><Link href="/admin" className="inline-flex items-center justify-center border border-line bg-panel rounded-lg font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2 px-3 py-[7px] text-[13px]">{t('back')}</Link><QrModal qrDataUrl={qrDataUrl} code={data.code} uid={data.uid} defaultOpen={sp.qr === '1'} /><PrintButton /></div><Receipt data={data} qrDataUrl={qrDataUrl} /></div>;
}
