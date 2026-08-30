export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { getAuthUser, requireInvestor } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import ProfileForm from '@/components/auth/ProfileForm';
import { getTranslations } from 'next-intl/server';

type Props = { params: Promise<{ locale: string }> };

export default async function RegisterProfilePage({ params }: Props) {
  const { locale } = await params;
  const user = await getAuthUser();
  if (!user) redirect({ href: '/register', locale });

  // If the user already has an Investor row, skip profile creation
  try {
    await requireInvestor();
    redirect({ href: '/portal', locale });
  } catch {
    // No Investor row — proceed to profile form
  }

  // The verified email comes from the auth session — the form claims the
  // deposit phone separately (linked server-side with an NID match).
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const verifiedEmail: string | null = !error && data.user?.email ? data.user.email : null;

  const t = await getTranslations({ locale, namespace: 'register' });
  return (
    <Card className="max-w-[420px]">
      <div className="space-y-5 p-6">
        <div className="space-y-2">
          <h1 className="font-display text-[38px] font-bold leading-tight">{t('profileTitle')}</h1>
          <p className="text-ink-soft">{t('profileLead')}</p>
        </div>
        {verifiedEmail ? <p className="text-sm text-ink-soft">{t('verifiedEmail', { email: verifiedEmail })}</p> : null}
        <ProfileForm verifiedEmail={verifiedEmail} />
      </div>
    </Card>
  );
}
