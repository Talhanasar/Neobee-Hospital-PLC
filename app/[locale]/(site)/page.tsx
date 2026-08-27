export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { buttonClasses } from '@/components/ui/Button';
import { LedgerLine } from '@/components/ui/LedgerLine';
import { getSettings } from '@/lib/settings';
import { getPublicSummary } from '@/lib/queries';
import { formatBdt, MAX_SHARES } from '@/lib/money';

// Amounts are pre-formatted before reaching t(): see GoalBanner note on ICU values.
const bdt = (amount: number) => `৳${formatBdt(amount)}`;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing' });
  const tc = await getTranslations({ locale, namespace: 'categories' });
  const settings = await getSettings();
  const summary = await getPublicSummary();

  const facts = [
    { value: bdt(settings.SHARE_PRICE), label: t('factsPerShare') },
    { value: bdt(MAX_SHARES * settings.SHARE_PRICE), label: t('factsMaxSubscription') },
    { value: bdt(10 * settings.SHARE_PRICE), label: t('factsEntrepreneurEntry') },
    { value: bdt(settings.INCENTIVE_PER_SHARE), label: t('factsBonusPerShare') },
  ];

  const benefits = [
    { heading: 'why1Heading', body: 'why1Body' },
    { heading: 'why2Heading', body: 'why2Body' },
    { heading: 'why4Heading', body: 'why4Body' },
  ];

  const shareRows = [
    { category: 'SHAREHOLDER' as const, minShares: 1, rangeKey: 'rangeShareholder' as const },
    { category: 'PREMIUM' as const, minShares: 5, rangeKey: 'rangePremium' as const },
    { category: 'DIRECTOR' as const, minShares: 10, rangeKey: 'rangeDirector' as const },
  ];

  return (
    <div>
      <section
        className="py-16 text-center text-white md:py-24"
        style={{ background: 'linear-gradient(135deg, #201D12 0%, #3A2D0A 60%, #A96F05 100%)' }}
      >
        <div className="shell space-y-5 pb-10 md:pb-14">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/70">{t('heroKicker')}</p>
          <h1 className="mx-auto max-w-[760px] font-display text-[38px] font-bold leading-tight md:text-[48px]">{t('title')}</h1>
          <p className="mx-auto max-w-[640px] text-white/80">{t('heroTagline')}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Link href="/register" className={buttonClasses('primary')}>{t('ctaRegister')}</Link>
            <Link href="/verify" className="inline-flex items-center justify-center rounded-lg border border-white/25 px-3 py-[7px] text-[13px] font-semibold text-white hover:bg-white/10">
              {t('ctaVerify')}
            </Link>
          </div>
        </div>
      </section>

      <LedgerLine
        confirmedAmount={summary.totalRaised}
        targetAmount={summary.settings.TARGET_AMOUNT}
        registeredCount={summary.sharesSubscribed}
        confirmedCount={summary.entrepreneurSlotsFilled}
        updatedAt="live"
        locale={locale}
      />

      <section className="shell relative z-10 -mt-10 py-16 md:py-24">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {facts.map((fact, i) => (
            <div key={i} className="rounded-card border border-line bg-panel p-6">
              <p className="num text-[22px] font-semibold text-ink">{fact.value}</p>
              <p className="mt-1 text-xs font-semibold text-ink-soft">{fact.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell py-16 md:py-24">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="font-display text-[26px] font-bold leading-tight">{t('aboutHeading')}</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">{t('whatIs')}</p>
            <ul className="mt-6 space-y-4">
              {benefits.map((benefit, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden="true" className="hex mt-1 h-5 w-4 shrink-0 bg-honey" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{t(benefit.heading)}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">{t(benefit.body)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-card border border-line bg-panel">
            <div className="border-b border-line p-4">
              <h3 className="font-semibold text-ink">{t('categoriesHeading')}</h3>
            </div>
            <div className="space-y-4 p-5">
              {shareRows.map((row) => (
                <div key={row.category} className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{tc(row.category)}</span>
                  <span className="num text-sm text-ink-soft">{bdt(row.minShares * settings.SHARE_PRICE)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="shell py-16 md:py-24">
        <h2 className="font-display text-[26px] font-bold leading-tight">{t('tiersHeading')}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t('tiersLead')}</p>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="rounded-card border border-line bg-panel p-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-blue">{tc('SHAREHOLDER')}</p>
            <p className="num mt-3 text-[24px] font-semibold text-ink">{bdt(settings.SHARE_PRICE)}</p>
            <p className="mt-1 text-xs text-ink-soft">{t('rangeShareholder')}</p>
            <ul className="mt-5 space-y-2.5">
              {[t('tierBenefitsReceipt'), t('tierBenefitsQr'), t('tierBenefitsCertificate')].map((line, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink-soft">
                  <span aria-hidden="true" className="font-bold text-ink-soft">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-card border border-honey bg-honey-soft p-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">{tc('PREMIUM')}</p>
            <p className="num mt-3 text-[24px] font-semibold text-ink">{bdt(5 * settings.SHARE_PRICE)}</p>
            <p className="mt-1 text-xs text-ink-soft">{t('rangePremium')}</p>
            <ul className="mt-5 space-y-2.5">
              {[t('tierBenefitsReceipt'), t('tierBenefitsQr'), t('tierBenefitsCertificate')].map((line, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink-soft">
                  <span aria-hidden="true" className="font-bold text-ink-soft">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-card border border-ink bg-ink p-6 text-white">
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">{tc('DIRECTOR')}</p>
            <p className="num mt-3 text-[24px] font-semibold text-white">{bdt(10 * settings.SHARE_PRICE)}</p>
            <p className="mt-1 text-xs text-white/70">{t('rangeDirector')}</p>
            <ul className="mt-5 space-y-2.5">
              {[t('tierBenefitsReceipt'), t('tierBenefitsQr'), t('tierBenefitsCommittee')].map((line, i) => (
                <li key={i} className="flex gap-2 text-sm text-white/85">
                  <span aria-hidden="true" className="font-bold text-white/70">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="shell py-16 md:py-24">
        <div
          className="rounded-card px-6 py-10 text-center text-white"
          style={{ background: 'linear-gradient(135deg, #201D12 0%, #3A2D0A 100%)' }}
        >
          <h2 className="font-display text-[24px] font-bold">{t('aboutCtaHeading')}</h2>
          <p className="mt-2 text-sm text-white/75">{t('aboutCtaLead')}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className={buttonClasses('primary')}>{t('ctaRegister')}</Link>
            <Link href="/about" className="inline-flex items-center justify-center rounded-lg border border-white/25 px-3 py-[7px] text-[13px] font-semibold text-white hover:bg-white/10">
              {t('aboutCta')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
