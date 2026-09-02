'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { demoLoginAction } from '@/app/[locale]/(auth)/login/actions';
import { ShieldCheckIcon, UserRoundIcon } from '@/components/ui/icons';

// One-click demo tour on the login card, ported from the reference design:
// tiles (hex icon + label + sub) that sign in as the seeded demo investors
// or admin. Visually secondary to the real email+password form. The kisti
// tile is DEMO_DATA-only — there is no Supabase-seeded identity for it.
export default function DemoLoginButtons() {
  const t = useTranslations('login');
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState(false);
  const showKisti = process.env.NEXT_PUBLIC_DEMO_DATA === 'true';

  const handle = (role: 'investor' | 'investor-kisti' | 'admin') => {
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

  const tile = (role: 'investor' | 'investor-kisti' | 'admin', Icon: typeof UserRoundIcon, labelKey: 'demoInvestor' | 'demoInvestorKisti' | 'demoAdmin', subKey: 'demoInvestorSub' | 'demoInvestorKistiSub' | 'demoAdminSub') => (
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
          {isPending ? t('demoSigningIn') : t(labelKey)}
        </span>
        <span className="block truncate text-xs text-ink-soft">{t(subKey)}</span>
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
      <div className={['mt-3 grid gap-2', showKisti ? 'grid-cols-3' : 'grid-cols-2'].join(' ')}>
        {tile('investor', UserRoundIcon, 'demoInvestor', 'demoInvestorSub')}
        {showKisti ? tile('investor-kisti', UserRoundIcon, 'demoInvestorKisti', 'demoInvestorKistiSub') : null}
        {tile('admin', ShieldCheckIcon, 'demoAdmin', 'demoAdminSub')}
      </div>
      {error ? (
        <div role="alert" className="mt-3 rounded-card bg-[#FBE4E2] px-4 py-3 text-center text-sm text-[#B3261E]">
          {t('demoError')}
        </div>
      ) : null}
    </div>
  );
}
