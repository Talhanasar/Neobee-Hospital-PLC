import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Neobee design-system "bits" — the shared visual vocabulary of the
 * reference design (hexagon marks, kickers, section heads, form fields,
 * decorative QR). Pure/server-safe: no hooks, no client directive.
 * Motion helpers live in ./use-count-up.ts and ./Reveal.tsx.
 */

/* ── Brand marks ───────────────────────────────────────────────── */

export function HexLogo({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size * 0.88}
      viewBox="0 0 100 88"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M27 4 H73 L96 44 L73 84 H27 L4 44 Z"
        fill="var(--color-honey)"
        stroke="var(--color-honey)"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <rect x="42" y="24" width="16" height="40" rx="3" fill="var(--color-paper)" />
      <rect x="30" y="36" width="40" height="16" rx="3" fill="var(--color-paper)" />
    </svg>
  );
}

export function HexOutline({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 100 88" fill="none" className={className} aria-hidden="true">
      <path
        d="M27 4 H73 L96 44 L73 84 H27 L4 44 Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HexAvatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`hex-clip-pointy grid h-10 w-11 place-items-center bg-honey-soft font-display text-sm font-bold text-honey-deep ${className ?? ''}`}
    >
      {initials}
    </div>
  );
}

/* ── Typography helpers ────────────────────────────────────────── */

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`nb-kicker flex items-center gap-2 ${className ?? ''}`}>
      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 bg-honey hex-clip" />
      {children}
    </p>
  );
}

export function SectionHead({
  kicker,
  title,
  sub,
  align = 'left',
  className,
}: {
  kicker: string;
  title: string;
  sub?: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={`max-w-2xl ${align === 'center' ? 'mx-auto text-center' : ''} ${className ?? ''}`}
    >
      <Kicker className={align === 'center' ? 'justify-center' : undefined}>{kicker}</Kicker>
      <h2 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">{title}</h2>
      {sub ? <p className="mt-3 leading-relaxed text-ink-soft">{sub}</p> : null}
    </div>
  );
}

/* ── Buttons & fields ──────────────────────────────────────────── */

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

const BTN_VARIANTS = {
  primary: 'bg-honey text-ink hover:bg-honey-deep hover:text-paper',
  outline: 'border border-line bg-panel text-ink hover:border-honey hover:bg-honey-soft/60',
  ghost: 'text-ink-soft hover:bg-honey-soft/60 hover:text-ink',
  soft: 'bg-honey-soft text-honey-deep hover:bg-honey/30',
} as const;

const BTN_SIZES = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
} as const;

export type BitButtonProps = {
  variant?: keyof typeof BTN_VARIANTS;
  size?: keyof typeof BTN_SIZES;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function btnClasses(variant: keyof typeof BTN_VARIANTS = 'primary', size: keyof typeof BTN_SIZES = 'md', extra?: string) {
  return [BTN_BASE, BTN_VARIANTS[variant], BTN_SIZES[size], extra].filter(Boolean).join(' ');
}

export function Btn({ variant = 'primary', size = 'md', className, type = 'button', ...rest }: BitButtonProps) {
  return (
    <button
      type={type}
      className={btnClasses(variant, size, className)}
      {...rest}
    />
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-ink-soft">{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-amber">{error}</p> : null}
    </div>
  );
}

/* ── Decorative pseudo-QR (deterministic, clearly a placeholder) ─ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pseudoGrid(value: string, dim: number): boolean[][] {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  const rand = mulberry32(h);
  const grid: boolean[][] = Array.from({ length: dim }, () =>
    Array.from({ length: dim }, () => rand() > 0.52),
  );
  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[oy + y][ox + x] = edge || core;
      }
    }
  };
  finder(0, 0);
  finder(dim - 7, 0);
  finder(0, dim - 7);
  return grid;
}

export function PseudoQr({
  value,
  size = 96,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const dim = 25;
  const cells = pseudoGrid(value, dim);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code placeholder"
      className={className}
    >
      <rect width={dim} height={dim} fill="var(--color-panel)" />
      {cells.map((row, y) =>
        row.map((on, x) =>
          on ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="var(--color-ink)" /> : null,
        ),
      )}
    </svg>
  );
}

/** Hexagon-framed QR — the signature shape wrapping the signature code. */
export function HexQr({
  value,
  qrSize = 88,
  className,
}: {
  value: string;
  qrSize?: number;
  className?: string;
}) {
  return (
    <div className={`relative inline-block ${className ?? ''}`}>
      <HexOutline
        strokeWidth={2.5}
        className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] text-honey"
      />
      <div className="relative border border-line bg-panel p-2">
        <PseudoQr value={value} size={qrSize} />
      </div>
    </div>
  );
}
