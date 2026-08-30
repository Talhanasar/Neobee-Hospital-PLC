export const dynamic = 'force-dynamic';

import { requireStaff } from '@/lib/auth';
import { listRegistrations } from '@/lib/queries';
import { approveRegistrationAction } from './actions';
import { getTranslations } from 'next-intl/server';
import { btnClasses } from '@/components/ui/bits';

export default async function RegistrationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireStaff();
  const t = await getTranslations({ locale, namespace: 'admin' });
  const rows = await listRegistrations();
  const pendingCount = rows.filter((r) => r.approvalStatus === 'PENDING').length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold">{t('registrationsTitle')}</h2>
        <p className="text-ink-soft">{t('registrationsLead', { count: pendingCount.toLocaleString('en-IN') })}</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-panel p-8 text-center text-sm text-ink-soft">{t('registrationsEmpty')}</div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-panel">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                <th className="px-4 py-3">{t('regName')}</th>
                <th className="px-4 py-3">{t('regEmail')}</th>
                <th className="px-4 py-3">{t('regPhone')}</th>
                <th className="px-4 py-3">{t('regNid')}</th>
                <th className="px-4 py-3">{t('regInvestments')}</th>
                <th className="px-4 py-3">{t('regStatus')}</th>
                <th className="px-4 py-3" aria-label={t('regApprove')} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line/60 last:border-b-0">
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{row.email ?? '—'}</td>
                  <td className="num px-4 py-3">{row.phone}</td>
                  <td className="num px-4 py-3">{row.nationalIdNumber ?? '—'}</td>
                  <td className="num px-4 py-3">{row.investmentCount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    {row.approvalStatus === 'PENDING' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-[11px] font-semibold text-amber">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber" />
                        {t('regPending')}
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-soft px-2.5 py-1 text-[11px] font-semibold text-green">{t('regApproved')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.approvalStatus === 'PENDING' ? (
                      <form action={approveRegistrationAction}>
                        <input type="hidden" name="investorId" value={row.id} />
                        <button type="submit" className={btnClasses('primary', 'sm')}>
                          {t('regApprove')}
                        </button>
                      </form>
                    ) : (
                      <span aria-hidden="true" className="text-green">✓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
