import { getTranslations } from 'next-intl/server';
import { Money } from '@/components/ui/Money';
import { amountInWords } from '@/lib/money';

export interface CertificateHolding {
  uid: string;
  shares: number;
  amount: number;
  paidAt: Date;
}

export interface CertificateData {
  certRef: string; // `${firstUid}-CERT`
  code: string; // verification code of the most recent fully-paid holding
  investorName: string;
  category: 'SHAREHOLDER' | 'PREMIUM' | 'DIRECTOR' | 'GOLDEN_DIRECTOR';
  shares: number; // total across holdings
  sharePrice: number; // current setting, display only
  amount: number; // total across holdings
  issuedAt: Date; // earliest holding issue/paid date
  holdings: CertificateHolding[]; // sorted oldest first by paidAt
}

// Bank-facing document: English-only so the certificate and the PDF stay consistent.
export default async function Certificate({ data, qrDataUrl }: { data: CertificateData; qrDataUrl: string }) {
  const t = await getTranslations({ locale: 'en', namespace: 'certificate' });

  const categoryT = {
    SHAREHOLDER: t('categoryShareholder'),
    PREMIUM: t('categoryPremium'),
    DIRECTOR: t('categoryDirector'),
    GOLDEN_DIRECTOR: t('categoryGoldenDirector'),
  } as const;

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-[#0B6E99] bg-[#F7FAFC] p-2 print:rounded-none print:border-0">
      {/* inner gold frame */}
      <div className="relative rounded-xl border border-[#0B6E99] px-6 py-10 sm:px-10">
        {/* hexagon watermark */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="hex-clip-pointy h-64 w-72 bg-honey-soft/30" />
        </div>

        <div className="relative space-y-6 text-center">
          <p className="font-mono text-[10px] font-semibold tracking-[0.28em] text-ink-soft">
            {t('subHeader')}
          </p>
          <h1 className="font-display text-2xl font-bold tracking-[0.08em] text-ink sm:text-3xl">
            {t('entity')}
          </h1>
          <h2 className="font-display text-lg font-semibold text-honey-deep sm:text-xl">
            {t('title')}
          </h2>

          <p className="mx-auto max-w-md text-sm leading-relaxed text-ink">
            {t('body', {
              name: data.investorName,
              category: categoryT[data.category],
              shares: data.shares.toLocaleString('en-IN'),
              price: data.sharePrice.toLocaleString('en-IN'),
            })}
          </p>

          <div className="mx-auto w-full max-w-md overflow-x-auto">
            <table className="w-full border-collapse text-center">
              <caption className="sr-only">{t('holdingsTitle')}</caption>
              <thead>
                <tr>
                  <th className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft border-b border-[#0B6E99]/50 pb-1.5">{t('colUid')}</th>
                  <th className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft border-b border-[#0B6E99]/50 pb-1.5">{t('colShares')}</th>
                  <th className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft border-b border-[#0B6E99]/50 pb-1.5">{t('colAmount')}</th>
                  <th className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft border-b border-[#0B6E99]/50 pb-1.5">{t('colPaidOn')}</th>
                </tr>
              </thead>
              <tbody>
                {data.holdings.map((h) => (
                  <tr key={h.uid}>
                    <td className="num py-1 text-left">{h.uid}</td>
                    <td className="num py-1">{h.shares}</td>
                    <td className="py-1"><Money value={h.amount} /></td>
                    <td className="num py-1">{h.paidAt.toISOString().slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#0B6E99]/50">
                  <td colSpan={4} className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft pt-2 text-center">
                    {t('totalShares')}: <span className="num font-semibold">{data.shares}</span>
                    {' · '}
                    {t('totalAmount')}: <span className="num font-semibold"><Money value={data.amount} /></span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-sm italic text-ink-soft">
            {t('paidUpValue')} — {amountInWords(data.amount)} taka
          </p>
          <p className="font-display text-xl font-bold text-ink"><Money value={data.amount} /></p>

          <div className="mx-auto grid max-w-md grid-cols-3 gap-3 border-t border-[#0B6E99]/50 pt-5 text-left">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">{t('certNo')}</p>
              <p className="num mt-1 text-sm font-semibold">{data.certRef}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">{t('dateOfIssue')}</p>
              <p className="num mt-1 text-sm font-semibold">{data.issuedAt.toISOString().slice(0, 10)}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">{t('verificationCode')}</p>
              <p className="num mt-1 text-sm font-semibold">{data.code}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-6 pt-8">
            <div className="text-left">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not a remote asset */}
              <img src={qrDataUrl} alt={t('qrAlt', { code: data.code })} className="h-24 w-24" />
              <p className="mt-2 max-w-[180px] text-[10.5px] leading-snug text-ink-soft">
                {t('qrNote', { code: data.code })}
              </p>
            </div>
            <div className="flex items-end gap-10">
              <div className="text-center">
                <p className="font-display text-sm font-bold text-ink">{t('chairmanName')}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">{t('chairmanTitle')}</p>
                <div className="mt-8 w-44 border-t border-ink/60" />
              </div>
              <div className="text-center">
                <p className="font-display text-sm font-bold text-ink">{t('ceoName')}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">{t('ceoTitle')}</p>
                <div className="mt-8 w-44 border-t border-ink/60" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
