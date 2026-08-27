import { getTranslations } from 'next-intl/server';

export async function CategoryBadge({ category }: { category: 'SHAREHOLDER' | 'PREMIUM' | 'DIRECTOR' }) {
  const t = await getTranslations('categories');
  const classes = {
    SHAREHOLDER: 'bg-blue-soft text-blue',
    PREMIUM: 'bg-violet-soft text-violet',
    DIRECTOR: 'bg-honey-soft text-ink',
  }[category];
  return <span className={[classes, 'inline-block text-[11.5px] font-semibold px-[9px] py-[3px] rounded-md whitespace-nowrap'].join(' ')}>{t(category)}</span>;
}
