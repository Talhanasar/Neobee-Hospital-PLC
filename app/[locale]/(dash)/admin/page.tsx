export const dynamic = 'force-dynamic';

import { LedgerLine } from '@/components/ui/LedgerLine';
import { Money } from '@/components/ui/Money';
import { StatCard } from '@/components/ui/StatCard';
import { getPublicSummary, getAdminStats, listInvestmentsPage } from '@/lib/queries';
import { listInvestmentsSchema } from '@/lib/validation';
import { ShareholderTable } from '@/components/admin/ShareholderTable';
import { getTranslations } from 'next-intl/server';
import { ZodError } from 'zod';
import { requireStaff } from '@/lib/auth';

export default async function AdminPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  await requireStaff();
  const t = await getTranslations({ locale, namespace: 'admin' });
  const sp = await searchParams;
  const parsed = (() => { try { return listInvestmentsSchema.parse(sp); } catch (error) { if (error instanceof ZodError) return listInvestmentsSchema.parse({}); throw error; } })();
  const [summary, stats, result] = await Promise.all([getPublicSummary(), getAdminStats(), listInvestmentsPage(parsed)]);
  const updatedAt = new Date().toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return <div className="space-y-6"><header className="space-y-3"><p className="nb-kicker flex items-center gap-2"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 bg-honey hex-clip" />{t('consoleKicker')}</p><h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t('dashboardTitle')}</h1><p className="max-w-2xl text-ink-soft">{t('dashboardLead')}</p></header><LedgerLine confirmedAmount={stats.confirmedAmount} targetAmount={summary.settings.TARGET_AMOUNT} registeredCount={stats.totalCount} confirmedCount={stats.confirmedCount} updatedAt={updatedAt} locale={locale} /><div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]"><StatCard label={t('statSharesTaken')} value={stats.sharesTaken.toLocaleString('en-IN')} hint={t('statSharesTakenHint', { left: (summary.settings.TARGET_SHARES - stats.sharesTaken).toLocaleString('en-IN') })} /><StatCard label={t('statTotal')} value={<Money value={stats.totalSubscribed} />} hint={t('statTotalHint', { count: stats.totalCount.toLocaleString('en-IN') })} /><StatCard label={t('statConfirmed')} value={<Money value={stats.confirmedAmount} />} hint={t('statConfirmedHint', { count: stats.confirmedCount.toLocaleString('en-IN') })} tone="confirmed" /><StatCard label={t('statPending')} value={<Money value={stats.pendingAmount} />} hint={t('statPendingHint', { count: stats.pendingCount.toLocaleString('en-IN') })} /><StatCard label={t('statIncentives')} value={<Money value={stats.incentivesDue} />} hint={t('statIncentivesHint', { count: stats.entrepreneurCount.toLocaleString('en-IN') })} /><StatCard label={t('statPendingRequests')} value={stats.pendingRequestCount.toString()} hint={t('statPendingRequestsHint', { count: stats.pendingRequestCount.toLocaleString('en-IN') })} tone="confirmed" link="/admin/requests" /></div><ShareholderTable result={result} query={parsed} /></div>;
}
