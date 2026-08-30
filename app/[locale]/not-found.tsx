'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { btnClasses } from '@/components/ui/bits';

export default function NotFound() {
  const t = useTranslations('notFound');
  return (
    <section className="flex min-h-screen items-center justify-center px-4">
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-semibold text-ink">{t('title')}</h1>
        <p className="max-w-sm text-sm text-ink-soft">{t('description')}</p>
        <Link href="/" className={btnClasses('outline', 'lg')}>
          {t('backHome')}
        </Link>
      </div>
    </section>
  );
}
