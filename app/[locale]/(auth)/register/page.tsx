export const dynamic = 'force-dynamic';

import { getAuthUser } from '@/lib/auth';
import { Link, redirect } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import LoginForm from '@/components/auth/LoginForm';
import { getTranslations } from 'next-intl/server';

type Props = { params: Promise<{ locale: string }> };

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  // Already authenticated investors with a record should go straight to the portal
  const user = await getAuthUser();
  if (user) redirect({ href: '/portal', locale });
  const t = await getTranslations({ locale, namespace: 'register' });
  const authT = await getTranslations({ locale, namespace: 'auth' });
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="w-full max-w-[420px] space-y-6">
        <div className="text-center">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-soft">{t('investorAccess')}</span>
        </div>
        <Card>
          <div className="space-y-5 p-6">
            <div className="space-y-2">
              <h1 className="font-display text-[38px] font-bold leading-tight">{t('title')}</h1>
              <p className="text-ink-soft">{t('lead')}</p>
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{t('codeHelper')}</p>
              <div className="border-t border-line" />
            </div>
            <LoginForm mode="register" />
            <div className="mt-6 text-center text-sm">
              <span className="text-ink-soft">{authT('registeredAlready')} </span>
              <Link href="/login" className="font-semibold text-ink hover:underline">{authT('logIn')}</Link>
            </div>
          </div>
        </Card>
        <div className="text-center text-xs text-ink-soft">{t('helpline')}</div>
      </div>
    </div>
  );
}
