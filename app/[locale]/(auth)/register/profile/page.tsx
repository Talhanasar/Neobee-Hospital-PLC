export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { getAuthUser, requireInvestor } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { normalizeBangladeshiPhone } from '@/lib/validation';
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

  // Read phone from verified session (server never trusts form)
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  let phoneDisplay: string | null = null;
  if (!error && data.user) {
    const rawPhone = (data.user.user_metadata?.phone ?? data.user.phone ?? '') as string;
    try {
      phoneDisplay = normalizeBangladeshiPhone(rawPhone);
    } catch {
      phoneDisplay = rawPhone || null;
    }
  }

  const t = await getTranslations({ locale, namespace: 'register' });
  return (
    <Card className="max-w-[420px]">
      <div className="space-y-5 p-6">
        <div className="space-y-2">
          <h1 className="font-display text-[38px] font-bold leading-tight">{t('profileTitle')}</h1>
          <p className="text-ink-soft">{t('profileLead')}</p>
        </div>
        {phoneDisplay ? <p className="text-sm text-ink-soft">{t('verifiedPhone', { phone: phoneDisplay })}</p> : null}
        <ProfileForm verifiedPhone={phoneDisplay} />
      </div>
    </Card>
  );
}
