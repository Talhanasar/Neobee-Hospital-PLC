import { getTranslations } from 'next-intl/server';
import { Money } from '@/components/ui/Money';
import { amountInWords } from '@/lib/money';
import type { ReceiptData } from '@/lib/receipt';

export default async function Receipt({ data, qrDataUrl }: { data: ReceiptData; qrDataUrl: string }) {
  // Bank-facing document: keep it in English so the screen receipt, PDF, and amount-in-words stay consistent.
  const t = await getTranslations({ locale: 'en', namespace: 'receipt' });
  const methodT = await getTranslations({ locale: 'en', namespace: 'methods' });

  const categoryT = {
    SHAREHOLDER: t('categoryShareholder'),
    PREMIUM: t('categoryPremium'),
    DIRECTOR: t('categoryDirector'),
    GOLDEN_DIRECTOR: t('categoryGoldenDirector'),
  } as const;

  const rows: Array<{ label: string; value: React.ReactNode } | null> = [
    { label: t('receivedFrom'), value: data.investorName },
    { label: t('contact'), value: <span className="num">{data.investorPhone}</span> },
    data.nationalIdNumber ? { label: t('nid'), value: <span className="num">{data.nationalIdNumber}</span> } : null,
    { label: t('category'), value: <span>{categoryT[data.category]}{data.isEntrepreneur ? t('entrepreneurSuffix') : ''}</span> },
    { label: t('sharesSubscribed'), value: <span className="num">{data.shares} × <Money value={data.sharePrice} /></span> },
    data.incentiveAmount > 0 ? { label: t('incentive'), value: <Money value={data.incentiveAmount} /> } : null,
    data.kistiRef ? { label: t('kistiLabel'), value: <span className="num">{data.kistiRef}</span> } : null,
    { label: t('method'), value: <span>{methodT(data.depositMethod)}</span> },
    data.depositRef ? { label: t('reference'), value: <span className="num">{data.depositRef}</span> } : null,
    data.paidToDate != null && data.totalAmount != null ? { label: t('paidToDate'), value: <span className="num"><Money value={data.paidToDate} /> / <Money value={data.totalAmount} /></span> } : null,
    { label: t('code'), value: <span className="num">{data.code}</span> },
    { label: t('status'), value: <span>{data.status === 'CONFIRMED' ? t('statusConfirmed') : t('statusPending')}</span> },
  ];

  return (
    <section className="border border-line rounded-xl overflow-hidden bg-panel">
      <div className="bg-ink text-white px-[22px] py-[18px] flex gap-3 items-center">
        <svg viewBox="0 0 38 42" width="38" height="42" aria-hidden="true" className="shrink-0">
          <polygon points="19,1 36,11 36,31 19,41 2,31 2,11" fill="#0B6E99" />
          <polygon points="19,8 30,14.5 30,27.5 19,34 8,27.5 8,14.5" fill="#F7FAFC" />
          <text x="19" y="26" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="800" fontSize="13" fill="#0A4D6B">N</text>
        </svg>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[18px] font-semibold leading-tight">{t('title')}</div>
          <div className="text-[12px] text-white/80">{t('subtitle')}</div>
        </div>
        <div className="text-right text-[12px] leading-tight">
          <div className="text-white/80">{t('receiptNo')}</div>
          <div className="num font-semibold text-[15px]">{data.uid}</div>
          <div className="text-white/80">{data.depositDate.toISOString().slice(0, 10)}</div>
        </div>
      </div>
      <div className="px-[22px] py-5 grid gap-[18px] [grid-template-columns:1fr_130px] max-md:grid-cols-1">
        <div>
          <div className="space-y-0.5">
            {rows.filter((row): row is { label: string; value: React.ReactNode } => row !== null).map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-3 py-1.5 border-b border-line last:border-b-0">
                <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{label}</div>
                <div className="text-right">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <div className="flex justify-between gap-3 items-end">
              <div className="text-ink-soft font-medium">{t('amountReceived')}</div>
              <div className="text-[18px] font-semibold"><Money value={data.amount} /></div>
            </div>
            <div className="text-xs text-ink-soft mt-1.5 italic">{amountInWords(data.amount)} {t('takaOnly')}</div>
          </div>
        </div>
        <div className="text-center">
          {/* Data-URL QR: next/image cannot optimize a data: URI, and its wrapper markup breaks the print layout. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="" width={130} height={130} className="mx-auto" />
          <div className="mt-2 text-[11px] text-ink-soft">{t('qrCaption')} <span className="num">{data.code}</span></div>
        </div>
      </div>
      <div className="border-t border-line px-[22px] py-3 text-[11px] text-ink-soft flex justify-between gap-2.5 flex-wrap">
        <div>{t('footNotice')}</div>
      </div>
    </section>
  );
}
