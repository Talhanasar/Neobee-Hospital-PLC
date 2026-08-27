import { getTranslations } from 'next-intl/server';
import VerifyLookup from '@/components/verify/VerifyLookup';

export default async function VerifyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'verify' });

  return <div className="space-y-6"><section className="space-y-3"><h1 className="font-display text-[38px] font-bold leading-tight">{t('title')}</h1><p className="max-w-[620px] text-ink-soft">{t('lead')}</p></section><div className="max-w-[600px]"><VerifyLookup /></div></div>;
}
