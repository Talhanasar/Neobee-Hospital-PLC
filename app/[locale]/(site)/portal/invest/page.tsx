export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { requireInvestor, AuthError } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { Card } from '@/components/ui/Card';
import InvestForm from '@/components/portal/InvestForm';

type Props = { params: Promise<{ locale: string }> };

export default async function InvestPage({ params }: Props) {
  const { locale } = await params;
  try {
    await requireInvestor();
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 401) redirect({ href: '/login', locale });
      // 403: authenticated but no Investor row
      redirect({ href: '/register/profile', locale });
    }
    throw error;
  }
  const settings = await getSettings();
  return (
    <div className="shell">
      <Card className="max-w-[640px]">
        <div className="space-y-5 p-6">
          <InvestForm sharePrice={settings.SHARE_PRICE} incentivePerShare={settings.INCENTIVE_PER_SHARE} />
        </div>
      </Card>
    </div>
  );
}
