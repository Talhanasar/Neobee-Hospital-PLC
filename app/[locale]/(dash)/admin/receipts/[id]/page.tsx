export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Link, redirect } from '@/i18n/navigation';
import { AuthError, requireStaff } from '@/lib/auth';
import { getReceiptData, listPaymentsForInvestment } from '@/lib/queries';
import { RecordPaymentForm } from '@/components/admin/RecordPaymentForm';
import { Money } from '@/components/ui/Money';
import { renderQrDataUrl, verificationQrPayload } from '@/lib/qr';
import { QrModal } from '@/components/receipt/QrModal';
import Receipt from '@/components/receipt/Receipt';
import { PrintButton } from '@/components/receipt/PrintButton';
import { getTranslations } from 'next-intl/server';

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const embed = sp.embed;
  try { await requireStaff(); } catch (error) { if (error instanceof AuthError) redirect({ href: '/login', locale }); throw error; }
  const data = await getReceiptData(id);
  if (!data) notFound();
  const payments = await listPaymentsForInvestment(id);
  const qrDataUrl = await renderQrDataUrl(verificationQrPayload({ code: data.code }));
  const t = await getTranslations('admin');
  const methodT = await getTranslations('methods');
  return <div className="space-y-4">{embed !== '1' ? (<div className="no-print flex flex-wrap gap-2"><Link href="/admin" className="inline-flex items-center justify-center border border-line bg-panel rounded-lg font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2 px-3 py-[7px] text-[13px]">{t('back')}</Link><QrModal qrDataUrl={qrDataUrl} code={data.code} uid={data.uid} defaultOpen={sp.qr === '1'} /><PrintButton /></div>) : null}<Receipt data={data} qrDataUrl={qrDataUrl} />{embed !== '1' ? (<section className="no-print grid gap-4 lg:grid-cols-2"><div className="bg-panel border border-line rounded-card p-5"><h2 className="font-display text-lg font-bold text-ink">{t('paymentsHistoryTitle')}</h2>{payments.length === 0 ? <p className="mt-3 text-sm text-ink-soft">{t('paymentsEmpty')}</p> : <table className="mt-3 w-full border-collapse"><thead><tr><th scope="col" className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft border-b border-line">{t('colDepositDate')}</th><th scope="col" className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft border-b border-line">{t('colAmount')}</th><th scope="col" className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft border-b border-line">{t('colDepositMethod')}</th><th scope="col" className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft border-b border-line">{t('colReviewedBy')}</th></tr></thead><tbody>{payments.map((p) => (<tr key={p.id} className="border-b border-line/60"><td className="px-2 py-2 text-sm num">{(p.depositDate ?? p.createdAt).toISOString().slice(0, 10)}</td><td className="px-2 py-2 text-sm font-semibold num"><Money value={p.amount} /></td><td className="px-2 py-2 text-sm">{p.depositMethod ? methodT(p.depositMethod) : p.type}</td><td className="px-2 py-2 text-xs text-ink-soft">{p.recordedByName ?? '—'}</td></tr>))}</tbody></table>}</div><div className="bg-panel border border-line rounded-card p-5"><h2 className="font-display text-lg font-bold text-ink">{t('paymentRecordTitle')}</h2><p className="mt-1 text-sm text-ink-soft">{t('paymentRecordLead')}</p><div className="mt-4"><RecordPaymentForm investmentId={id} /></div></div></section>) : null}</div>;
}
