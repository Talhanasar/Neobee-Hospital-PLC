export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { requireStaff, AuthError } from '@/lib/auth';
import PasswordChangeForm from '@/components/portal/PasswordChangeForm';
import { getTranslations } from 'next-intl/server';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminPasswordPage({ params }: Props) {
  const { locale } = await params;
  try {
    await requireStaff();
  } catch (error) {
    if (error instanceof AuthError) redirect({ href: '/login', locale });
    throw error;
  }
  const t = await getTranslations({ locale, namespace: 'portal' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">{t('passwordTitle')}</h2>
        <p className="text-ink-soft">{t('passwordLead')}</p>
      </div>
      <div className="max-w-md rounded-card border border-line bg-panel p-6">
        <PasswordChangeForm />
      </div>
    </div>
  );
}
