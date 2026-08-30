export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { requireInvestor, AuthError } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { listInvestmentsForInvestor } from '@/lib/queries';
import InvestForm from '@/components/portal/InvestForm';

type Props = { params: Promise<{ locale: string }> };

export default async function InvestPage({ params }: Props) {
  const { locale } = await params;
  let investor;
  try {
    investor = await requireInvestor();
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 401) redirect({ href: '/login', locale });
      // 403: authenticated but no Investor row
      redirect({ href: '/register/profile', locale });
    }
    throw error;
  }
  const [settings, investments] = await Promise.all([
    getSettings(),
    listInvestmentsForInvestor(investor.id),
  ]);

  return (
    <div className="shell">
      <div className="nb-card max-w-[640px] p-6">
        <InvestForm
          sharePrice={settings.SHARE_PRICE}
          incentivePerShare={settings.INCENTIVE_PER_SHARE}
          investments={investments.map((row) => ({
            id: row.id,
            uid: row.uid,
            category: row.category,
            shares: row.shares,
            status: row.status,
          }))}
        />
      </div>
    </div>
  );
}
