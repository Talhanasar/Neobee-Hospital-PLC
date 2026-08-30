'use client';

import { useTranslations } from 'next-intl';
import { btnClasses } from '@/components/ui/bits';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  return (
    <section className="flex min-h-screen items-center justify-center px-4">
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-semibold text-ink">{t('title')}</h1>
        <p className="max-w-sm text-sm text-ink-soft">{t('description')}</p>
        <button type="button" onClick={reset} className={btnClasses('primary', 'lg')}>
          {t('retry')}
        </button>
        <p className="text-xs text-ink-soft">
          {t('digest', { digest: error.digest ?? 'unknown' })}
        </p>
      </div>
    </section>
  );
}
