import { getTranslations } from 'next-intl/server';
import LeadForm from '@/components/interest/LeadForm';

export const dynamic = 'force-dynamic';

export default async function InterestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await getTranslations({ locale, namespace: 'interest' });

  return (
    <div className="hex-bg">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <LeadForm />
      </div>
    </div>
  );
}
