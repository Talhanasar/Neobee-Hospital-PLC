export const dynamic = 'force-dynamic';

import { Link, redirect } from '@/i18n/navigation';
import { requireInvestor, AuthError } from '@/lib/auth';
import { listInvestmentsForInvestor, listSchedulesForInvestor, listRequestsForInvestor } from '@/lib/queries';
import InvestmentsTable from '@/components/portal/InvestmentsTable';
import { getTranslations } from 'next-intl/server';

type Props = { params: Promise<{ locale: string }> };

export default async function InvestmentsPage({ params }: Props) {
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
  const t = await getTranslations({ locale, namespace: 'portal' });
  const [rows, schedules, requests] = await Promise.all([
    listInvestmentsForInvestor(investor.id),
    listSchedulesForInvestor(investor.id),
    listRequestsForInvestor(investor.id),
  ]);

  // A kisti is "verifying" when a SUBMITTED PAYMENT request targets it.
  const pendingClaims = new Set(
    requests
      .filter((r) => r.status === 'SUBMITTED' && r.kind === 'PAYMENT' && r.installmentNo != null && r.targetInvestmentUid)
      .map((r) => `${r.targetInvestmentUid}-K${r.installmentNo}`),
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t('investmentsTitle')}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">{t('investmentsLead')}</p>
        </div>
        <Link href="/portal/invest/new" className="inline-flex h-10 items-center rounded-lg bg-honey px-4 text-sm font-semibold text-white hover:bg-honey-deep">
          {t('requestSubmit')}
        </Link>
      </section>

      <InvestmentsTable
        rows={rows.map((row) => ({
          id: row.id,
          uid: row.uid,
          code: row.code,
          category: row.category,
          shares: row.shares,
          amount: row.amount,
          totalAmount: row.totalAmount,
          status: row.status,
          paymentPlan: row.paymentPlan,
          depositDate: row.depositDate.toISOString(),
          confirmedAt: row.confirmedAt?.toISOString() ?? null,
          paymentGroup: row.paymentGroup ?? null,
          kistis: (schedules.get(row.id) ?? []).map((s) => ({
            id: s.id,
            installmentNo: s.installmentNo,
            amount: s.amount,
            dueDate: s.dueDate.toISOString(),
            status: s.status,
            pendingClaim: pendingClaims.has(`${row.uid}-K${s.installmentNo}`),
          })),
        }))}
      />
    </div>
  );
}
