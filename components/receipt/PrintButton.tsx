'use client';

import { Button } from '@/components/ui/Button';
import { useTranslations } from 'next-intl';

export function PrintButton() {
  const t = useTranslations('admin');
  return <Button size="sm" onClick={() => window.print()}>{t('print')}</Button>;
}
