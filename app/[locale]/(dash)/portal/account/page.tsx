export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { requireInvestor, AuthError } from '@/lib/auth';
import AccountDetailsForm from '@/components/portal/AccountDetailsForm';
import { getTranslations } from 'next-intl/server';

type Props = { params: Promise<{ locale: string }> };

export default async function PortalAccountPage({ params }: Props) {
  const { locale } = await params;
  let investor;
  try {
    investor = await requireInvestor();
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 401) redirect({ href: '/login', locale });
      redirect({ href: '/register', locale });
    }
    throw error;
  }
  const t = await getTranslations({ locale, namespace: 'portal' });

  return (
    <div className="shell">
      <div className="mx-auto max-w-md">
        <div className="nb-card p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-ink">{t('accountTitle')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('accountLead')}</p>
          <div className="mt-6">
            <AccountDetailsForm
              account={{
                name: investor.name,
                phone: investor.phone,
                email: investor.email,
                nationalIdNumber: investor.nationalIdNumber,
                tin: investor.tin,
                address: investor.address,
                memberSince: investor.createdAt.toISOString().slice(0, 10),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
