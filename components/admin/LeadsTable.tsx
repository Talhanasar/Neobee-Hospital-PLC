'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { markLeadContactedAction } from '@/app/[locale]/(dash)/admin/leads/actions';
import { BadgeCheckIcon } from '@/components/ui/icons';

export type LeadRow = {
  id: string;
  ref: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: 'NEW' | 'CONTACTED';
  contactedAt: Date | string | null;
  createdAt: Date | string;
};

const th = 'px-3.5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft';
const td = 'px-3.5 py-3 align-top text-sm text-ink';

function fmtDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Staff pipeline for public interest leads. Rows are never deleted —
    a lead moves NEW → CONTACTED once the desk has called. */
export default function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const t = useTranslations('admin');

  if (leads.length === 0) {
    return (
      <div className="nb-card p-10 text-center">
        <p className="font-semibold text-ink">{t('leadsEmptyTitle')}</p>
        <p className="mt-1.5 text-sm text-ink-soft">{t('leadsEmptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="nb-card overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse">
        <caption className="sr-only">{t('leadsTableCaption')}</caption>
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={th}>{t('leadsColRef')}</th>
            <th scope="col" className={th}>{t('leadsColName')}</th>
            <th scope="col" className={th}>{t('leadsColPhone')}</th>
            <th scope="col" className={th}>{t('leadsColEmail')}</th>
            <th scope="col" className={th}>{t('leadsColMessage')}</th>
            <th scope="col" className={th}>{t('leadsColReceived')}</th>
            <th scope="col" className={th}>{t('leadsColStatus')}</th>
            <th scope="col" className={th}>{t('leadsColAction')}</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-line/70 last:border-0">
              <td className={`${td} num font-semibold`}>{lead.ref}</td>
              <td className={`${td} font-medium`}>{lead.name}</td>
              <td className={`${td} num`}>{lead.phone}</td>
              <td className={`${td} num text-xs`}>{lead.email ?? '—'}</td>
              <td className={`${td} max-w-[240px] truncate text-ink-soft`} title={lead.message ?? undefined}>
                {lead.message ?? '—'}
              </td>
              <td className={`${td} num text-xs`}>{fmtDate(lead.createdAt)}</td>
              <td className={td}>
                {lead.status === 'NEW' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber-soft px-2.5 py-1 text-[11px] font-semibold text-amber">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber" />
                    {t('leadsStatusNew')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-green/40 bg-green-soft px-2.5 py-1 text-[11px] font-semibold text-green">
                    <BadgeCheckIcon size={12} aria-hidden="true" />
                    {t('leadsStatusContacted')}
                  </span>
                )}
                {lead.contactedAt ? (
                  <span className="num mt-1 block text-[10px] text-ink-soft">{fmtDate(lead.contactedAt)}</span>
                ) : null}
              </td>
              <td className={td}>
                {lead.status === 'NEW' ? (
                  <form action={markLeadContactedAction}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center rounded-lg border border-line bg-panel px-3 text-xs font-semibold text-ink transition-colors hover:border-honey hover:bg-honey-soft/60 focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
                    >
                      {t('leadsMarkContacted')}
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-ink-soft">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
