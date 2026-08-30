export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { getSessionContext } from '@/lib/auth';
import { loadIdentityForShell } from '@/lib/session';
import { prisma } from '@/lib/db';
import { demoInvestorForAuthUser, isDemoData } from '@/data/demo/store';
import DashboardShell from '@/components/layout/DashboardShell';
import { getTranslations } from 'next-intl/server';

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSessionContext();
  if (!session.user) {
    redirect({ href: '/login', locale });
    return; // redirect() throws, but TS can't see that across the boundary
  }
  const identity = await loadIdentityForShell(session.user.id);

  // Approval gate: self-registered investors see a pending screen instead of
  // the portal until staff approve them.
  let pendingApproval = false;
  if (session.isInvestor) {
    if (isDemoData()) {
      pendingApproval = demoInvestorForAuthUser(session.user.id)?.approvalStatus === 'PENDING';
    } else {
      const investor = await prisma.investor.findUnique({
        where: { authUserId: session.user.id },
        select: { approvalStatus: true },
      });
      pendingApproval = investor?.approvalStatus === 'PENDING';
    }
  }
  if (pendingApproval) {
    const t = await getTranslations({ locale, namespace: 'portal' });
    return (
      <DashboardShell zone="investor" identity={identity}>
        <div className="rounded-card border border-line bg-panel p-6 sm:p-8">
          <p className="nb-kicker flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 bg-honey hex-clip" />
            {t('pendingKicker')}
          </p>
          <h1 className="mt-3 font-display text-2xl font-bold text-ink sm:text-3xl">{t('pendingTitle')}</h1>
          <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">{t('pendingBody')}</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell zone="investor" identity={identity}>
      {children}
    </DashboardShell>
  );
}
