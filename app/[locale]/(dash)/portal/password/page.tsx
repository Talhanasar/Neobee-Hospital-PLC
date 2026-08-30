export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { requireInvestor, AuthError } from '@/lib/auth';
import PasswordChangeForm from '@/components/portal/PasswordChangeForm';
import { getTranslations } from 'next-intl/server';

type Props = { params: Promise<{ locale: string }> };

export default async function PortalPasswordPage({ params }: Props) {
  const { locale } = await params;
  try {
    await requireInvestor();
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 401) redirect({ href: '/login', locale });
      redirect({ href: '/register/profile', locale });
    }
    throw error;
  }
  const t = await getTranslations({ locale, namespace: 'portal' });

  return (
    <div className="shell">
      <div className="mx-auto max-w-md">
        <div className="nb-card p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-ink">{t('passwordTitle')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('passwordLead')}</p>
          <div className="mt-6">
            <PasswordChangeForm />
          </div>
        </div>
      </div>
    </div>
  );
}
