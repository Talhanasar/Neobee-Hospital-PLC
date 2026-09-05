export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { requireInvestor, AuthError } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { listInvestmentsForInvestor, listSchedulesForInvestor } from '@/lib/queries';
import InvestForm from '@/components/portal/InvestForm';

type Props = { params: Promise<{ locale: string }> };

export default async function NewInvestmentPage({ params }: Props) {
  const { locale } = await params;
  let investor;
  try {
    investor = await requireInvestor();
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 401) redirect({ href: '/login', locale });
      // 403: authenticated but no Investor row
      redirect({ href: '/register', locale });
    }
    throw error;
  }
  const [settings, investments, schedules] = await Promise.all([
    getSettings(),
    listInvestmentsForInvestor(investor.id),
    listSchedulesForInvestor(investor.id),
  ]);

  return (
    <div className="space-y-4">
      <InvestForm
        sharePrice={settings.SHARE_PRICE}
        incentivePerShare={settings.INCENTIVE_PER_SHARE}
        investments={investments.map((row) => ({
          id: row.id,
          uid: row.uid,
          category: row.category,
          shares: row.shares,
          status: row.status,
          paymentPlan: row.paymentPlan,
        }))}
        installments={[...schedules.values()].flat()
          .filter((s): s is typeof s & { investmentId: string } => s.investmentId !== null)
          .map((s) => ({
            investmentId: s.investmentId,
            installmentNo: s.installmentNo,
            amount: s.amount,
            dueDate: s.dueDate.toISOString(),
            status: s.status,
          }))}
      />
    </div>
  );
}
