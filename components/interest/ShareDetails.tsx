import { getTranslations } from 'next-intl/server';
import { formatBdt } from '@/lib/money';

const SHARE_PRICE = 200000;
const KISTI_UNIT = 50000;

/**
 * Share details + shareholder facilities for prospective investors.
 * Static marketing content — figures mirror the DEFAULT_SETTINGS constants;
 * when the admin edits prices at runtime, this section is updated in the
 * same release cycle (it is deliberately not live-bound to the Setting
 * table because these are printed-plan numbers, not a progress readout).
 */
export default async function ShareDetails() {
  const t = await getTranslations('shareDetails');

  const tiers = [1, 5, 10, 25].map((shares, i) => ({
    shares,
    name: [t('tier1'), t('tier5'), t('tier10'), t('tier25')][i],
    diagnosis: ['30%', '35%', '40%', '50%'][i],
    bill: ['15%', '20%', '25%', '30%'][i],
  }));

  return (
    <section aria-labelledby="share-details-title" className="mb-12 space-y-8">
      <div className="max-w-2xl">
        <p className="nb-kicker flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 bg-honey hex-clip" />
          {t('kicker')}
        </p>
        <h2 id="share-details-title" className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
          {t('title')}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t('lead')}</p>
      </div>

      {/* Price + payment options */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="nb-card p-6">
          <h3 className="font-display text-lg font-bold text-ink">{t('fullTitle')}</h3>
          <p className="mt-2 num font-display text-2xl font-bold text-ink">৳{formatBdt(SHARE_PRICE)}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {t('fullBody', { full: formatBdt(SHARE_PRICE) })}
          </p>
        </div>
        <div className="nb-card p-6">
          <h3 className="font-display text-lg font-bold text-ink">{t('kistiTitle')}</h3>
          <p className="mt-2 num font-display text-2xl font-bold text-ink">৳{formatBdt(KISTI_UNIT)} <span className="text-base font-semibold">× 4</span></p>
          <p className="mt-1 text-sm text-ink-soft">{t('kistiBody')}</p>
          <p className="mt-2 text-xs text-ink-soft">{t('kistiOneShareNote')}</p>
        </div>
      </div>

      {/* Tier benefits table */}
      <div className="nb-card overflow-hidden">
        <h3 className="border-b border-line px-6 py-4 font-display text-lg font-bold text-ink">{t('benefitsTitle')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t('benefitsTitle')}</caption>
            <thead>
              <tr className="border-b border-line bg-paper text-left">
                <th scope="col" className="px-6 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{t('colTier')}</th>
                <th scope="col" className="px-6 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{t('colShares')}</th>
                <th scope="col" className="px-6 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{t('colDiagnosis')}</th>
                <th scope="col" className="px-6 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{t('colBill')}</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr key={tier.shares} className="border-b border-line last:border-b-0">
                  <td className="px-6 py-3.5 font-semibold text-ink">{tier.name}</td>
                  <td className="num px-6 py-3.5 text-ink-soft">
                    {tier.shares === 25 ? t('shares25') : `${tier.shares}–${[4, 9, 24][tiers.indexOf(tier)]}`}
                  </td>
                  <td className="num px-6 py-3.5 font-semibold text-ink">{tier.diagnosis}</td>
                  <td className="num px-6 py-3.5 font-semibold text-ink">{tier.bill}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-6 py-3.5 text-xs leading-relaxed text-ink-soft">{t('benefitsNote')}</p>
      </div>

      {/* Family coverage + documents + bank + refund */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="nb-card p-6">
          <h3 className="font-display text-lg font-bold text-ink">{t('familyTitle')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('familyBody')}</p>
          <ul className="mt-3 space-y-1.5 text-sm text-ink">
            {[t('family1'), t('family2'), t('family3'), t('family4')].map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 bg-honey hex-clip" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">{t('familyMax')}</p>
        </div>
        <div className="nb-card p-6">
          <h3 className="font-display text-lg font-bold text-ink">{t('docsTitle')}</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-ink">
            {[t('doc1'), t('doc2'), t('doc3'), t('doc4')].map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 bg-honey hex-clip" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="nb-card p-6">
          <h3 className="font-display text-lg font-bold text-ink">{t('bankTitle')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('bankBody')}</p>
          <div className="num mt-3 space-y-1 rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink">
            <p className="font-semibold">Neobee Hospital</p>
            <p>{t('bankAccount')}: 300811100007597</p>
            <p>{t('bankName')}: Shahjalal Islami Bank Ltd., Chawkbazar Branch, Chattogram</p>
            <p>{t('bankRouting')}: 190151935</p>
          </div>
        </div>
        <div className="nb-card p-6">
          <h3 className="font-display text-lg font-bold text-ink">{t('refundTitle')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('refundBody')}</p>
        </div>
      </div>
    </section>
  );
}
