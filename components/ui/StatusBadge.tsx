import { getTranslations } from 'next-intl/server';

export async function StatusBadge({ status }: { status: 'PENDING' | 'CONFIRMED' }) {
  const t = await getTranslations('statuses');
  const classes = status === 'PENDING' ? 'bg-amber-soft text-ink' : 'bg-green-soft text-green';
  return <span className={[classes, 'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap'].join(' ')}><span aria-hidden className="w-1.5 h-1.5 rounded-full bg-current" />{t(status)}</span>;
}
