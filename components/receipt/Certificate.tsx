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

// Tier system: the money receipt is identical for every shareholder — the
// certificate is where the level shows. escalating frame/accent/seal per tier.
const TIERS: Record<
  CertificateData['category'],
  { frame: string; accent: string; chip: string; watermark: string; seal: string | null; double: boolean }
> = {
  SHAREHOLDER: { frame: '#0B6E99', accent: '#0A4D6B', chip: 'bg-blue-soft text-blue', watermark: 'bg-blue-soft/40', seal: null, double: false },
  PREMIUM: { frame: '#5B6B8C', accent: '#44536E', chip: 'bg-violet-soft text-violet', watermark: 'bg-violet-soft/40', seal: null, double: false },
  DIRECTOR: { frame: '#C9A227', accent: '#8A6D1C', chip: 'bg-honey-soft text-honey-deep', watermark: 'bg-honey-soft/50', seal: 'DIRECTOR', double: false },
  GOLDEN_DIRECTOR: { frame: '#A67C00', accent: '#8A6D1C', chip: 'bg-honey text-ink', watermark: 'bg-honey/25', seal: 'GOLDEN', double: true },
};

// Printed-signature look. Intentionally font-stack based so it renders in
// browsers and in print-to-PDF without shipping a font file; swap in scanned
// signature images here when the hospital provides them.
const SIGNATURE_FONT = "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive";

// Bank-facing document: English-only so the certificate and the PDF stay consistent.
export default async function Certificate({ data, qrDataUrl }: { data: CertificateData; qrDataUrl: string }) {
  const t = await getTranslations({ locale: 'en', namespace: 'certificate' });

  const categoryT = {
    SHAREHOLDER: t('categoryShareholder'),
    PREMIUM: t('categoryPremium'),
    DIRECTOR: t('categoryDirector'),
    GOLDEN_DIRECTOR: t('categoryGoldenDirector'),
  } as const;

  const tier = TIERS[data.category];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2 bg-[#F7FAFC] p-2 print:rounded-none print:border-0 print:break-inside-avoid"
      style={{ borderColor: tier.frame }}
    >
      {/* inner frame */}
      <div className="relative rounded-xl border px-6 py-10 sm:px-10 print:px-6 print:py-6" style={{ borderColor: tier.frame }}>
        {/* golden tiers get a third, inset frame line */}
        {tier.double ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-lg border-2" style={{ borderColor: tier.accent, opacity: 0.55 }} />
        ) : null}

        {/* hexagon watermark, tinted per tier */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className={`hex-clip-pointy h-64 w-72 ${tier.watermark}`} />
        </div>

        {/* tier seal medallion */}
        {tier.seal ? (
          <div
            aria-hidden="true"
            className={`hex-clip-pointy absolute right-6 top-6 grid h-20 w-20 place-items-center ${tier.chip} ${tier.double ? 'h-24 w-24' : ''}`}
          >
            <span className="px-2 text-center font-mono text-[8px] font-bold leading-tight tracking-[0.14em]">
              {tier.seal}
            </span>
          </div>
        ) : null}

        <div className="relative space-y-6 text-center print:space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local static brand asset */}
          <img
            src="/images/neobee-logo.jpeg"
            alt=""
            className="mx-auto h-16 w-16 rounded-xl border border-line object-cover shadow-sm print:h-14 print:w-14"
          />
          <p className="font-mono text-[10px] font-semibold tracking-[0.28em] text-ink-soft">
            {t('subHeader')}
          </p>
          <h1 className="font-display text-2xl font-bold tracking-[0.08em] text-ink sm:text-3xl">
            {t('entity')}
          </h1>
          <h2 className="font-display text-lg font-semibold sm:text-xl" style={{ color: tier.accent }}>
            {t('title')}
          </h2>

          {/* tier ribbon */}
          <p className="flex justify-center">
            <span
              className={`inline-block rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${tier.chip}`}
            >
              {tier.seal ? '★ ' : ''}
              {categoryT[data.category]}
            </span>
          </p>

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

          <div className="mx-auto grid max-w-md grid-cols-3 gap-3 border-t border-[#0B6E99]/50 pt-5 text-left print:pt-4">
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

          <div className="flex flex-wrap items-end justify-between gap-4 pt-8 sm:flex-nowrap sm:gap-6 print:flex-nowrap print:gap-6 print:pt-5">
            <div className="text-left">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not a remote asset */}
              <img src={qrDataUrl} alt={t('qrAlt', { code: data.code })} className="h-24 w-24" />
              <p className="mt-2 max-w-[180px] text-[10.5px] leading-snug text-ink-soft">
                {t('qrNote', { code: data.code })}
              </p>
            </div>
            <div className="flex items-end gap-4 sm:gap-10 print:gap-6">
              <div className="text-center">
                <p aria-hidden="true" style={{ fontFamily: SIGNATURE_FONT }} className="text-[22px] leading-none text-ink/70">
                  {t('chairmanName')}
                </p>
                <div className="mt-2 w-44 border-t border-ink/60 mx-auto" />
                <p className="mt-1.5 font-display text-sm font-bold text-ink">{t('chairmanName')}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">{t('chairmanTitle')}</p>
              </div>
              <div className="text-center">
                <p aria-hidden="true" style={{ fontFamily: SIGNATURE_FONT }} className="text-[22px] leading-none text-ink/70">
                  {t('ceoName')}
                </p>
                <div className="mt-2 w-44 border-t border-ink/60 mx-auto" />
                <p className="mt-1.5 font-display text-sm font-bold text-ink">{t('ceoName')}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">{t('ceoTitle')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
