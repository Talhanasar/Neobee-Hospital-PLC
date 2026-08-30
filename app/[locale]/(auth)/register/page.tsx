export const dynamic = 'force-dynamic';

import { getAuthUser } from '@/lib/auth';
import { Link, redirect } from '@/i18n/navigation';
import RegisterForm from '@/components/auth/RegisterForm';
import { getTranslations } from 'next-intl/server';
import { HexLogo } from '@/components/ui/bits';

type Props = { params: Promise<{ locale: string }> };

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  // Already authenticated investors go straight to the portal
  const user = await getAuthUser();
  if (user) redirect({ href: '/portal', locale });
  const t = await getTranslations({ locale, namespace: 'register' });
  const authT = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="nb-card p-6 sm:p-8">
      {/* Brand + heading */}
      <div className="flex flex-col items-center text-center">
        <HexLogo size={44} />
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">{t('title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('lead')}</p>
      </div>

      <div className="mt-6">
        <RegisterForm />
      </div>

      <div className="mt-5 text-center text-sm">
        <span className="text-ink-soft">{authT('registeredAlready')} </span>
        <Link
          href="/login"
          className="font-semibold text-honey-deep underline decoration-honey/50 underline-offset-4 hover:decoration-honey"
        >
          {authT('logIn')}
        </Link>
      </div>
    </div>
  );
}
