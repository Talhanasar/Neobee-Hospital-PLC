import { getTranslations } from 'next-intl/server';
import { Card, CardHead } from '@/components/ui/Card';

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });

  return (
    <div className="py-16 md:py-24 space-y-6">
      <section className="space-y-3">
        <h1 className="font-display text-[38px] font-bold leading-tight">{t('title')}</h1>
        <p className="max-w-[620px] text-ink-soft">{t('lead')}</p>
      </section>
      <Card><CardHead><h2>{t('purposeHeading')}</h2></CardHead><div className="p-6 text-sm text-ink-soft">{t('purpose')}</div></Card>
      <Card><CardHead><h2>{t('locationHeading')}</h2></CardHead><div className="p-6 text-sm text-ink-soft">{t('location')}</div></Card>
      <Card><CardHead><h2>{t('governanceHeading')}</h2></CardHead><div className="p-6 text-sm text-ink-soft">{t('governance')}</div></Card>
      <Card><CardHead><h2>{t('modelHeading')}</h2></CardHead><div className="p-6 space-y-3 text-sm text-ink-soft"><p>{t('model')}</p><p>{t('benefits')}</p><p>{t('deposit')}</p></div></Card>
      <Card>
        <CardHead><h2>{t('contactsHeading')}</h2></CardHead>
        <div className="p-6 space-y-3 text-sm">
          <div><div className="font-semibold">{t('contact1Name')}</div><div className="text-ink-soft">{t('contact1Role')}</div></div>
          <div><div className="font-semibold">{t('contact2Name')}</div><div className="text-ink-soft">{t('contact2Role')}</div></div>
          <div><div className="font-semibold">{t('contact3Name')}</div><div className="text-ink-soft">{t('contact3Role')}</div></div>
        </div>
      </Card>
    </div>
  );
}
