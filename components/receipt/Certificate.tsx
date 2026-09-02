import { getTranslations } from 'next-intl/server';
import { Money } from '@/components/ui/Money';
import { certRef, amountInWords } from '@/lib/money';

export interface CertificateData {
  uid: string;
  code: string;
  investorName: string;
  category: 'SHAREHOLDER' | 'PREMIUM' | 'DIRECTOR' | 'GOLDEN_DIRECTOR';
  shares: number;
  sharePrice: number;
  amount: number;
  issuedAt: Date;
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
    <div className="relative overflow-hidden rounded-2xl border-2 border-[#d4af37] bg-[#fcfbf7] p-2 print:rounded-none print:border-0">
      {/* inner gold frame */}
      <div className="relative rounded-xl border border-[#d4af37] px-6 py-10 sm:px-10">
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
              uid: data.uid,
            })}
          </p>

          <p className="text-sm italic text-ink-soft">
            {t('paidUpValue')} — {amountInWords(data.amount)} taka
          </p>
          <p className="font-display text-xl font-bold text-ink"><Money value={data.amount} /></p>

          <div className="mx-auto grid max-w-md grid-cols-3 gap-3 border-t border-[#d4af37]/50 pt-5 text-left">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">{t('certNo')}</p>
              <p className="num mt-1 text-sm font-semibold">{certRef(data.uid)}</p>
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
            <div className="text-center">
              <p className="font-display text-sm font-bold text-ink">{t('chairmanName')}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">{t('chairmanTitle')}</p>
              <div className="mt-8 w-44 border-t border-ink/60" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
