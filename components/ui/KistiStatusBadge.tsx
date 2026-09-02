'use client';

import { useTranslations } from 'next-intl';

// Kisti status pill shared by the portal investments table, the portal
// overview, and the admin kisti sub-tables — one place so the label set
// (Paid / Verifying / Scheduled / Overdue / Cancelled) never drifts.
export function KistiStatusBadge({
  status,
  pendingClaim = false,
}: {
  status: 'SCHEDULED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  pendingClaim?: boolean;
}) {
  const t = useTranslations('portal');
  const classes = {
    SCHEDULED: 'bg-blue-soft text-blue',
    PAID: 'bg-green-soft text-green',
    OVERDUE: 'bg-[#FBE4E2] text-[#B3261E]',
    CANCELLED: 'bg-paper text-ink-soft',
  }[status];
  const label = pendingClaim
    ? t('kistiVerifying')
    : status === 'PAID'
      ? t('kistiPaid')
      : status === 'SCHEDULED'
        ? t('kistiScheduled')
        : status === 'OVERDUE'
          ? t('kistiOverdue')
          : t('kistiCancelled');
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-[9px] py-[3px] text-[11.5px] font-semibold ${classes}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
