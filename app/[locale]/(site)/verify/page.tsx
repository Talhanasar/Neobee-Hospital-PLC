import { getTranslations } from 'next-intl/server';
import VerifyLookup from '@/components/verify/VerifyLookup';

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

        {/* ScanViewfinder + lookup live together inside VerifyLookup (it owns the
            two-column split). No Suspense boundary: VerifyLookup reads the ?code=
            param from window.location, so no useSearchParams streaming dependency. */}
        <div className="mx-auto grid max-w-4xl gap-6">
          <VerifyLookup />
        </div>
      </div>
    </div>
  );
}
