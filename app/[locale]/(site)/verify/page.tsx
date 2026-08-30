import { getTranslations } from 'next-intl/server';
import VerifyLookup from '@/components/verify/VerifyLookup';
import { Kicker } from '@/components/ui/bits';
import { CameraIcon, InfoIcon } from '@/components/ui/icons';
import ScanViewfinder from '@/components/verify/ScanViewfinder';

export const dynamic = 'force-dynamic';

export default async function VerifyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'verify' });

  return (
    <div className="hex-bg">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto mb-8 max-w-xl text-center">
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{t('title')}</h1>
        </div>

        <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_1.15fr]">
          {/* Demo viewfinder — hexagon frame, scan line, no real camera */}
          <div className="nb-card relative overflow-hidden p-5">
            <Kicker>{t('scanTitle')}</Kicker>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">{t('scanSub')}</p>

            <ScanViewfinder statusLabel={t('scanStatus')} okLabel="✓ NB-VERIFY-OK" />

            <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-ink-soft">
              <InfoIcon size={13} className="mt-0.5 shrink-0 text-honey-deep" aria-hidden="true" />
              {t('scanDemo')}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-soft/80">
              <CameraIcon size={12} aria-hidden="true" />
              {t('scanNoCamera')}
            </p>
          </div>

          {/* Code lookup */}
          <VerifyLookup />
        </div>
      </div>
    </div>
  );
}
