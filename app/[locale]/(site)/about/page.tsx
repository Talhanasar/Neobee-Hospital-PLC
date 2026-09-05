import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Reveal } from '@/components/ui/Reveal';
import { HexAvatar, HexOutline, Kicker, SectionHead } from '@/components/ui/bits';
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from '@/components/ui/icons';
import SecFlash from '@/components/about/SecFlash';

export const dynamic = 'force-dynamic';

/** About sections reachable via /about?sec=… (Home "At a glance" links). */
const SECS = ['origin', 'partnership', 'leadership', 'values', 'visit'] as const;

export default async function AboutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const secParam = typeof sp.sec === 'string' ? sp.sec : undefined;
  const t = await getTranslations({ locale, namespace: 'about' });

  const origin = [t('origin1'), t('origin2'), t('origin3')];
  const steps = [
    { title: t('step1Title'), body: t('step1Body') },
    { title: t('step2Title'), body: t('step2Body') },
    { title: t('step3Title'), body: t('step3Body') },
  ];
  const leaders = [
    { name: t('contact1Name'), role: t('contact1Role'), initials: 'JA' },
    { name: t('contact2Name'), role: t('contact2Role'), initials: 'MR' },
  ];
  const values = [
    { title: t('value1Title'), body: t('value1Text') },
    { title: t('value2Title'), body: t('value2Text') },
    { title: t('value3Title'), body: t('value3Text') },
    { title: t('value4Title'), body: t('value4Text') },
  ];

  return (
    <div>
      <SecFlash sec={secParam} valid={SECS} />

      {/* 1 · PAGE HEAD */}
      <section className="pt-12 sm:pt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <Kicker>{t('headKicker')}</Kicker>
            <h1 className="mt-3 max-w-2xl text-3xl font-bold text-ink sm:text-4xl">{t('h1')}</h1>
          </Reveal>
          <Reveal delay={100} className="relative mt-10">
            <HexOutline
              strokeWidth={1.5}
              className="absolute -right-3 -top-3 z-10 w-20 text-honey sm:-right-4 sm:-top-4 sm:w-24"
            />
            <div className="nb-card overflow-hidden">
              <Image
                src="/images/about-blueprint.png"
                alt={t('headAlt')}
                width={1344}
                height={768}
                priority
                className="h-auto w-full object-cover"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 2 · ORIGIN — split copy / image */}
      <section id="about-origin" aria-label={t('originKicker')} className="scroll-mt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <Kicker>{t('originKicker')}</Kicker>
            <h2 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">{t('originTitle')}</h2>
            <div className="mt-5 space-y-4 leading-relaxed text-ink-soft">
              {origin.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="nb-card overflow-hidden">
              <Image
                src="/images/render-ward.png"
                alt={t('originAlt')}
                width={1344}
                height={768}
                className="h-auto w-full object-cover"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 3 · FOUNDING-ENTREPRENEUR IDEA — numbered steps */}
      <section id="about-partnership" aria-label={t('partnerKicker')} className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
          <SectionHead align="center" kicker={t('partnerKicker')} title={t('partnerTitle')} />
          <div className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-5">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 90} className="h-full">
                <div className="nb-card h-full p-6">
                  <p className="num text-3xl font-bold text-honey-deep">{i + 1}</p>
                  <h3 className="mt-3 font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · LEADERSHIP */}
      <section id="about-leadership" aria-label={t('leadKicker')} className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHead align="center" kicker={t('leadKicker')} title={t('leadTitle')} />
          <div className="mt-10 flex flex-wrap justify-center gap-6">
            {leaders.map((l, i) => (
              <Reveal key={l.name} delay={i * 90} className="w-full sm:w-80 h-full">
                <div className="nb-card h-full p-5">
                  <HexAvatar initials={l.initials} className="h-14 w-16 text-base" />
                  <h3 className="mt-4 font-semibold text-ink">{l.name}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{l.role}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5 · VALUES — hex-bullet grid */}
      <section id="about-values" aria-label={t('valuesKicker')} className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHead align="center" kicker={t('valuesKicker')} title={t('valuesTitle')} />
          <div className="mx-auto mt-10 grid max-w-4xl gap-x-10 gap-y-8 sm:grid-cols-2">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={i * 90}>
                <div className="flex items-start gap-3.5">
                  <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 bg-honey hex-clip" />
                  <div>
                    <h3 className="font-semibold text-ink">{v.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{v.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 6 · LOCATION & CONTACT */}
      <section id="about-visit" aria-label={t('visitKicker')} className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
          <SectionHead align="center" kicker={t('visitKicker')} title={t('visitTitle')} />
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 lg:grid-cols-2 lg:gap-6">
            <Reveal className="h-full">
              <div className="nb-card h-full space-y-5 p-6">
                <div className="flex items-center gap-3">
                  <MapPinIcon size={18} className="shrink-0 text-honey-deep" aria-hidden="true" />
                  <span className="text-sm text-ink">{t('visitAddress')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MailIcon size={18} className="shrink-0 text-honey-deep" aria-hidden="true" />
                  <span className="font-mono text-sm text-ink">{t('visitEmail')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <PhoneIcon size={18} className="shrink-0 text-honey-deep" aria-hidden="true" />
                  <span className="num text-sm text-ink">{t('visitPhone')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ClockIcon size={18} className="shrink-0 text-honey-deep" aria-hidden="true" />
                  <span className="text-sm text-ink">
                    {t('visitHoursDays')} <span className="num">{t('visitHoursTime')}</span>
                  </span>
                </div>
              </div>
            </Reveal>
            <Reveal delay={120} className="h-full">
              <div className="nb-card hex-bg grid h-full min-h-64 place-items-center p-6">
                <div className="flex flex-col items-center gap-3">
                  <span className="relative inline-block">
                    <HexOutline className="w-24 text-honey" strokeWidth={2} />
                    <MapPinIcon size={20} className="absolute inset-0 m-auto text-honey-deep" aria-hidden="true" />
                  </span>
                  <span className="text-xs text-ink-soft">{t('mapPlaceholder')}</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
