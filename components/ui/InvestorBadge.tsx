'use client';

import { useTranslations } from 'next-intl';
import { deriveCategory, InvestmentCategory } from '@/lib/money';

export function InvestorBadge({ shares }: { shares: number }) {
  const t = useTranslations('categories');
  if (!Number.isInteger(shares) || shares < 1) return null;
  const category = deriveCategory(shares);
  const tierClasses: Record<InvestmentCategory, string> = {
    SHAREHOLDER: 'bg-blue-soft text-blue',
    PREMIUM: 'bg-violet-soft text-violet',
    DIRECTOR: 'bg-honey-soft text-ink',
    GOLDEN_DIRECTOR: 'bg-honey-soft text-honey',
  };
  const dotClass: Record<InvestmentCategory, string> = {
    SHAREHOLDER: 'bg-blue',
    PREMIUM: 'bg-violet',
    DIRECTOR: 'bg-honey-deep',
    GOLDEN_DIRECTOR: 'bg-honey',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-[5px] text-[12px] font-semibold whitespace-nowrap ${tierClasses[category]}`}>
      <span aria-hidden="true" className={`inline-block h-2 w-2 hex-clip ${dotClass[category]}`} />
      {t(category)}
    </span>
  );
}
