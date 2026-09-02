'use client';

import { useTranslations } from 'next-intl';
import { InvestmentCategory } from '@/lib/money';

// Sync + client-safe: this badge renders inside client forms (InvestForm
// category preview), so it must never be an async server component.
export function CategoryBadge({ category }: { category: InvestmentCategory }) {
  const t = useTranslations('categories');
  const classes = {
    SHAREHOLDER: 'bg-blue-soft text-blue',
    PREMIUM: 'bg-violet-soft text-violet',
    DIRECTOR: 'bg-honey-soft text-ink',
    GOLDEN_DIRECTOR: 'bg-honey-soft text-honey',
  }[category];
  return <span className={[classes, 'inline-block text-[11.5px] font-semibold px-[9px] py-[3px] rounded-md whitespace-nowrap'].join(' ')}>{t(category)}</span>;
}
