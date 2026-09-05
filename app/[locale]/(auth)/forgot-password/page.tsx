import { getTranslations } from 'next-intl/server';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export default async function ForgotPasswordPage() {
  const t = await getTranslations('forgotPassword');

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">{t('title')}</h1>
        <p className="text-sm text-ink-soft">{t('lead')}</p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
