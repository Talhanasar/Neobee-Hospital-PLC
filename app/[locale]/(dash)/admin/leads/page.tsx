export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import LeadsTable from '@/components/admin/LeadsTable';
import { listLeads } from '@/lib/leads';

export default async function AdminLeadsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin' });
  const leads = await listLeads();

  return (
    <section className="space-y-4">
      <div className="max-w-2xl space-y-1.5">
        <h2 className="font-display text-2xl font-bold">{t('leadsTitle')}</h2>
        <p className="text-sm text-ink-soft">{t('leadsLead')}</p>
      </div>
      <LeadsTable
        leads={leads.map((lead) => ({
          ...lead,
          contactedAt: lead.contactedAt ? lead.contactedAt.toISOString() : null,
          createdAt: lead.createdAt.toISOString(),
        }))}
      />
    </section>
  );
}
