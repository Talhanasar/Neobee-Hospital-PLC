'use client';

import * as React from 'react';
import { Link } from '@/i18n/navigation';
import { useCountUp } from '@/components/ui/use-count-up';
import { ArrowUpRightIcon } from '@/components/ui/icons';

export type GlanceStatProps = {
  index: number;
  label: string;
  n: number;
  suffix: string;
  /** Rendered instead of the count-up when the stat is not numeric. */
  staticText: string | null;
  goAria: string;
  sec: string;
};

/** One stat in the at-a-glance strip — counts up when numeric and
    deep-links into the matching About section (smooth anchor scroll). */
export default function GlanceStat({
  index,
  label,
  n,
  suffix,
  staticText,
  goAria,
  sec,
}: GlanceStatProps) {
  const counted = useCountUp(n, 800 + index * 120);
  return (
    <Link
      href={`/about?sec=${sec}`}
      aria-label={`${goAria} — ${label}`}
      className="group relative block w-full rounded-lg pl-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey/60"
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-1.5 h-2.5 w-2.5 bg-honey hex-clip transition-transform duration-300 group-hover:scale-125 motion-reduce:transition-none"
      />
      <span className="flex items-start justify-between gap-1">
        <span
          className={`num block text-3xl font-bold text-ink transition-colors duration-300 group-hover:text-honey-deep ${
            index === 3 ? 'text-2xl sm:text-3xl' : ''
          }`}
        >
          {staticText ?? `${counted}${suffix}`}
        </span>
        <ArrowUpRightIcon
          size={15}
          aria-hidden="true"
          className="mt-1.5 shrink-0 text-honey-deep opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 motion-reduce:transition-none"
        />
      </span>
      <p className="mt-1 text-xs leading-snug text-ink-soft">{label}</p>
    </Link>
  );
}
