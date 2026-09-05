export const dynamic = 'force-dynamic';

import { Link, redirect } from '@/i18n/navigation';
import { getAuthUser } from '@/lib/auth';
import LoginForm from '@/components/auth/LoginForm';
import DemoLoginButtons from '@/components/auth/DemoLoginButtons';
import { getTranslations } from 'next-intl/server';
import { isDemoLoginEnabled } from '@/lib/demo-users';
import { HexLogo } from '@/components/ui/bits';
import { InfoIcon } from '@/components/ui/icons';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (await getAuthUser()) redirect({ href: '/portal', locale });
  const sp = await searchParams;
  const mode = sp.mode === 'register' ? 'register' : 'login';
  // Single registration path: ?mode=register on /login redirects to /register
  if (mode === 'register') redirect({ href: '/register', locale });  const t = await getTranslations({ locale, namespace: 'login' });
  const authT = await getTranslations({ locale, namespace: 'auth' });
  const demoEnabled = isDemoLoginEnabled();

  return (
    <div className="nb-card p-6 sm:p-8">
      {/* Brand + heading */}
      <div className="flex flex-col items-center text-center">
        <HexLogo size={44} />
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">{t('title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('lead')}</p>
      </div>

      <div className="mt-7">
        <LoginForm />
      </div>

      {demoEnabled ? (
        <div className="mt-6">
          <div className="flex gap-2 rounded-xl border border-amber/30 bg-amber-soft/70 p-3 text-xs leading-relaxed text-amber">
            <InfoIcon size={15} className="mt-0.5 shrink-0" />
            <p>{t('demoHint')}</p>
          </div>
          <div className="mt-4">
            <DemoLoginButtons showKisti={demoEnabled} />
          </div>
        </div>
      ) : null}

      <div className="mt-5 text-center text-sm">
        <span className="text-ink-soft">{authT('newHere')} </span>
        <Link
          href="/register"
          className="font-semibold text-honey-deep underline decoration-honey/50 underline-offset-4 hover:decoration-honey"
        >
          {authT('register')}
        </Link>
      </div>
    </div>
  );
}
