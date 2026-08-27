export const dynamic = 'force-dynamic';

import { Link, redirect } from '@/i18n/navigation';
import { getAuthUser } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import LoginForm from '@/components/auth/LoginForm';
import DemoLoginButtons from '@/components/auth/DemoLoginButtons';
import { getTranslations } from 'next-intl/server';
import { isDemoLoginEnabled } from '@/lib/demo-users';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (await getAuthUser()) redirect({ href: '/portal', locale });
  const sp = await searchParams;
  const mode = sp.mode === 'register' ? 'register' : 'login';
  // Single registration path: ?mode=register on /login redirects to /register
  if (mode === 'register') redirect({ href: '/register', locale });
  const t = await getTranslations({ locale, namespace: 'login' });
  const authT = await getTranslations({ locale, namespace: 'auth' });
  const title = mode === 'register' ? t('registerTitle') : t('title');
  const lead = mode === 'register' ? t('registerLead') : t('lead');
  const demoEnabled = isDemoLoginEnabled();
  return (
    <Card className="max-w-[420px]">
      <div className="space-y-5 p-6">
        <div className="space-y-2">
          <h1 className="font-display text-[38px] font-bold leading-tight">{title}</h1>
          <p className="text-ink-soft">{lead}</p>
        </div>
        <LoginForm mode={mode} />
        {demoEnabled ? (
          <div className="rounded-lg border border-dashed border-line bg-panel/50 p-3">
            <DemoLoginButtons />
          </div>
        ) : null}
        <div className="mt-6 text-center text-sm">
          <span className="text-ink-soft">{authT('newHere')} </span>
          <Link href="/register" className="font-semibold text-ink hover:underline">{authT('register')}</Link>
        </div>
      </div>
    </Card>
  );
}
