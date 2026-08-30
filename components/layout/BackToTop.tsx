'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpIcon } from '@/components/ui/icons';

const SHOW_AFTER = 480; // px of scroll before the button appears

/**
 * Back-to-top affordance shared by every zone. Appears after the first
 * screenful, bottom-left, flat hexagon-family styling, no-print,
 * safe-area aware, reduced-motion friendly.
 */
export default function BackToTop() {
  const t = useTranslations('common');
  const [visible, setVisible] = useState(false);

  /* Track scroll position passively; rAF-throttled via the state guard. */
  useEffect(() => {
    const onScroll = () => {
      const show = window.scrollY > SHOW_AFTER;
      setVisible((prev) => (prev === show ? prev : show));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label={t('backToTop')}
      title={t('backToTop')}
      onClick={() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      }}
      className="no-print fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.5rem)] right-[max(1rem,env(safe-area-inset-right))] z-40 grid h-11 w-11 place-items-center rounded-full border border-line bg-panel text-ink-soft transition-all duration-200 hover:border-honey hover:bg-honey-soft/70 hover:text-honey-deep active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey/60"
    >
      <ArrowUpIcon size={18} />
    </button>
  );
}
