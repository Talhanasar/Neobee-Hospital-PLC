import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/ui/Reveal';
import { HexOutline, Kicker, SectionHead, btnClasses } from '@/components/ui/bits';
import { HeartPulseIcon, ShieldCheckIcon, TrendingUpIcon, UsersIcon } from '@/components/ui/icons';
import GlanceStat from '@/components/home/GlanceStat';
import ProjectCardDialog from '@/components/home/ProjectCardDialog';

export const dynamic = 'force-dynamic';

/** About sections each glance stat deep-links to (anchor scroll + flash). */
const GLANCE_SECS = ['origin', 'visit', 'partnership', 'values'] as const;

const PILLAR_ICONS = [HeartPulseIcon, UsersIcon, ShieldCheckIcon, TrendingUpIcon];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing' });

  const chips = [t('chip1'), t('chip2'), t('chip3')];
  const features = [t('feature1'), t('feature2'), t('feature3')];
  const pillars = [
    { title: t('pillar1Title'), body: t('pillar1Body') },
    { title: t('pillar2Title'), body: t('pillar2Body') },
    { title: t('pillar3Title'), body: t('pillar3Body') },
    { title: t('pillar4Title'), body: t('pillar4Body') },
  ];
  const glance = [
    { label: t('glanceBeds'), n: 200, suffix: '+', staticText: null },
    { label: t('glanceEr'), n: 0, suffix: '', staticText: t('glanceStaticEr') },
    { label: t('glancePhases'), n: 3, suffix: '', staticText: null },
    { label: t('glanceOwned'), n: 0, suffix: '', staticText: t('glanceStaticOwned') },
  ];

  return (
    <div>
      {/* 1 · HERO — full-bleed hex pattern, two columns on lg */}
      <section className="hex-bg relative overflow-hidden border-b border-line">
        <HexOutline
          strokeWidth={1.5}
          className="hex-float pointer-events-none absolute -left-24 top-14 hidden w-80 text-honey/25 min-[1000px]:block"
        />
        <HexOutline
          strokeWidth={1.5}
          className="hex-float-slow pointer-events-none absolute -bottom-12 left-1/3 hidden w-72 text-line min-[1000px]:block"
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:pb-24 lg:pt-20">
          <Reveal>
            <Kicker>{t('kicker')}</Kicker>
            <h1 className="mt-4 text-4xl font-bold text-ink sm:text-5xl">{t('h1')}</h1>
            <p className="mt-5 max-w-xl leading-relaxed text-ink-soft">{t('sub')}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/interest" className={btnClasses('primary', 'lg')}>
                {t('cta1')}
              </Link>
              <Link href="/about" className={btnClasses('outline', 'lg')}>
                {t('cta2')}
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2.5">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-panel px-3.5 text-xs font-medium text-ink-soft"
                >
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-honey hex-clip" />
                  {chip}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={140}>
            <div className="relative mx-auto w-full max-w-[520px]">
              <HexOutline
                strokeWidth={1.5}
                className="absolute -right-5 -top-5 w-[calc(100%+2.5rem)] text-honey"
              />
              <div className="hex-clip-pointy relative aspect-[1/1.1] w-full overflow-hidden bg-panel">
                <Image
                  src="/images/hero-hospital.png"
                  alt={t('heroAlt')}
                  width={1440}
                  height={720}
                  priority
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Floating fact chips (decorative, sm+) */}
              <div className="absolute -left-5 top-8 z-10 hidden sm:block">
                <div className="nb-card flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-ink">
                  <span className="num">200+</span> {t('floatBeds')}
                </div>
              </div>
              <div className="absolute -right-4 top-1/3 z-10 hidden sm:block">
                <div className="nb-card flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-ink">
                  <span className="num">24/7</span> {t('floatEr')}
                </div>
              </div>
              <div className="absolute -left-6 bottom-8 z-10 hidden sm:block">
                <div className="nb-card flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-ink">
                  {t('floatLoc')}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 1.5 · AT A GLANCE — mono stats strip + shareable project card */}
      <section aria-label={t('glanceKicker')} className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-8">
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
            {glance.map((s, i) => (
              <GlanceStat
                key={s.label}
                index={i}
                label={s.label}
                n={s.n}
                suffix={s.suffix}
                staticText={s.staticText}
                goAria={t('glanceGo')}
                sec={GLANCE_SECS[i]}
              />
            ))}
          </div>
          <div className="shrink-0 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <ProjectCardDialog
              triggerLabel={t('glanceBtn')}
              title={t('glanceTitle')}
              drawingLabel={t('glanceDrawing')}
              downloadLabel={t('glanceDownload')}
              savedLabel={t('glanceSaved')}
              hint={t('glanceHint')}
              services={features}
              location={t('floatLoc')}
            />
          </div>
        </div>
      </section>

      {/* 2 · WHAT WE'RE BUILDING — split image / copy */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <div className="nb-card overflow-hidden">
              <Image
                src="/images/render-lobby.png"
                alt={t('projectImgAlt')}
                width={1344}
                height={768}
                className="h-auto w-full object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <Kicker>{t('projectKicker')}</Kicker>
            <h2 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">{t('projectTitle')}</h2>
            <p className="mt-4 leading-relaxed text-ink-soft">{t('projectBody')}</p>
            <ul className="mt-7 space-y-4">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm font-semibold text-ink">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 bg-honey hex-clip" />
                  {f}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 3 · OUR AIM — four promise cards */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead align="center" kicker={t('aimKicker')} title={t('aimTitle')} />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {pillars.map((p, i) => {
              const PillarIcon = PILLAR_ICONS[i];
              return (
                <Reveal key={p.title} delay={i * 90} className="h-full">
                  <div className="nb-card h-full p-5">
                    <div className="hex-clip-pointy grid h-12 w-[54px] place-items-center bg-honey-soft">
                      <PillarIcon size={22} className="text-honey-deep" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 font-semibold text-ink">{p.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">{p.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4 · BANGLA SIGNATURE BAND — stays Bangla in both locales */}
      <section className="border-y border-line bg-honey-soft py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <Reveal>
            <div className="flex items-center justify-center gap-4 sm:gap-6">
              <span aria-hidden="true" className="h-3 w-3.5 shrink-0 bg-honey hex-clip" />
              <p className="font-display text-3xl font-bold text-ink sm:text-5xl">{t('bandLine')}</p>
              <span aria-hidden="true" className="h-3 w-3.5 shrink-0 bg-honey hex-clip" />
            </div>
            <p className="mt-4 text-sm text-ink-soft sm:text-base">{t('bandGloss')}</p>
          </Reveal>
        </div>
      </section>

      {/* 5 · CLOSING CTA BAND */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Reveal>
            <Kicker className="justify-center">{t('joinKicker')}</Kicker>
            <h2 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">{t('joinTitle')}</h2>
            <p className="mt-4 leading-relaxed text-ink-soft">{t('joinBody')}</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href="/interest" className={btnClasses('primary', 'lg')}>
                {t('cta1')}
              </Link>
              <Link href="/gallery" className={btnClasses('outline', 'lg')}>
                {t('joinCta2')}
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-soft">
              {t('alreadyRegistered')}{' '}
              <Link
                href="/login"
                className="font-semibold text-honey-deep underline decoration-honey/50 underline-offset-4 hover:decoration-honey"
              >
                {t('signIn')}
              </Link>
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
