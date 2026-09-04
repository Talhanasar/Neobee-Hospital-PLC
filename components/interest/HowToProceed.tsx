import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { btnClasses } from '@/components/ui/bits';

/**
 * "How to proceed" — the guided path from landing to shareholding:
 * deposit → register → approval → documents. Static marketing content;
 * the register CTA routes to the signup wizard.
 */
export default async function HowToProceed() {
  const t = await getTranslations('interest');

  const steps = [
    { title: t('how1Title'), body: t('how1Body') },
    { title: t('how2Title'), body: t('how2Body') },
    { title: t('how3Title'), body: t('how3Body') },
    { title: t('how4Title'), body: t('how4Body') },
  ];

  return (
    <section aria-labelledby="how-to-title" className="mb-12 space-y-6">
      {/* Early-bird discount banner */}
      <div className="relative overflow-hidden rounded-card border border-honey/50 bg-honey-soft/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="hex-clip-pointy mt-0.5 grid h-10 w-[44px] shrink-0 place-items-center bg-honey font-display text-lg font-bold text-white">৳</span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink sm:text-xl">{t('earlyBirdTitle')}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{t('earlyBirdBody')}</p>
            </div>
          </div>
          <Link href="/register" className={`${btnClasses('primary', 'lg')} shrink-0`}>
            {t('registerNow')}
          </Link>
        </div>
        <p className="mt-3 text-xs text-ink-soft/80">{t('earlyBirdNote')}</p>
      </div>

      <div className="max-w-2xl">
        <h2 id="how-to-title" className="font-display text-2xl font-bold text-ink sm:text-3xl">
          {t('howTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('howLead')}</p>
      </div>

      <ol className="grid gap-4 sm:grid-cols-2">
        {steps.map((step, i) => (
          <li key={step.title} className="nb-card p-6">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="hex-clip-pointy grid h-8 w-9 shrink-0 place-items-center bg-honey-soft font-mono text-sm font-bold text-honey-deep">
                {i + 1}
              </span>
              <h3 className="font-display text-base font-bold text-ink">{step.title}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/register" className={btnClasses('primary', 'lg')}>
          {t('registerNow')}
        </Link>
        <span className="text-xs text-ink-soft">{t('alreadyHave')}</span>
      </div>
    </section>
  );
}
