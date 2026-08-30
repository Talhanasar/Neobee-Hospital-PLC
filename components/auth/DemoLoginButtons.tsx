'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { demoLoginAction } from '@/app/[locale]/(auth)/login/actions';
import { ShieldCheckIcon, UserRoundIcon } from '@/components/ui/icons';

// One-click demo tour on the login card, ported from the reference design:
// two tiles (hex icon + label + sub) that sign in as the seeded demo
// investor or admin. Visually secondary to the real phone+password form.
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

  const tile = (role: 'investor' | 'admin', Icon: typeof UserRoundIcon) => (
    <button
      type="button"
      disabled={isPending}
      onClick={() => handle(role)}
      className="group flex items-center gap-2.5 rounded-xl border border-line bg-panel p-3 text-left transition-colors hover:border-honey hover:bg-honey-soft/40 focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2 disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className="hex-clip-pointy grid h-9 w-10 shrink-0 place-items-center bg-honey-soft text-honey-deep transition-colors group-hover:bg-honey/30"
      >
        <Icon size={17} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">
          {isPending ? t('demoSigningIn') : role === 'investor' ? t('demoInvestor') : t('demoAdmin')}
        </span>
        <span className="block truncate text-xs text-ink-soft">
          {role === 'investor' ? t('demoInvestorSub') : t('demoAdminSub')}
        </span>
      </span>
    </button>
  );

  return (
    <div>
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{t('demoTour')}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {tile('investor', UserRoundIcon)}
        {tile('admin', ShieldCheckIcon)}
      </div>
      {error ? (
        <div role="alert" className="mt-3 rounded-card bg-[#FBE4E2] px-4 py-3 text-center text-sm text-[#B3261E]">
          {t('demoError')}
        </div>
      ) : null}
    </div>
  );
}
