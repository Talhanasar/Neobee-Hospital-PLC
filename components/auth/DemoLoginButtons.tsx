'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { demoLoginAction } from '@/app/[locale]/(auth)/login/actions';
import { Button } from '@/components/ui/Button';

// Compact demo affordance for the login card. One-click sign-in as the
// seeded demo investor or demo admin. Visually secondary to the real form.
export default function DemoLoginButtons() {
  const t = useTranslations('login');
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState(false);

  const handle = (role: 'investor' | 'admin') => {
    if (isPending) return;
    setError(false);
    startTransition(async () => {
      const result = await demoLoginAction(role);
      if (!result.ok) {
        setError(true);
        return;
      }
      router.push(result.role === 'admin' ? '/admin' : '/portal');
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-center text-sm text-ink-soft">{t('demoHint')}</p>
      <div className="flex gap-2">
        <Button type="button" variant="primary" disabled={isPending} onClick={() => handle('investor')} className="flex-1">
          {isPending ? t('demoSigningIn') : t('demoInvestor')}
        </Button>
        <Button type="button" variant="default" disabled={isPending} onClick={() => handle('admin')} className="flex-1">
          {isPending ? t('demoSigningIn') : t('demoAdmin')}
        </Button>
      </div>
      {error ? (
        <div role="alert" className="bg-[#FBE4E2] text-[#B3261E] rounded-card px-4 py-3 text-center text-sm">
          {t('demoError')}
        </div>
      ) : null}
    </div>
  );
}
