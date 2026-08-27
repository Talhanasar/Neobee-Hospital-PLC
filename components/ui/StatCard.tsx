import { Link } from '@/i18n/navigation';

export function StatCard({ label, value, hint, tone, link }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'default' | 'confirmed'; link?: string }) {
  const valueNode = typeof value === 'string' ? <span className="font-display text-2xl font-bold mt-1.5">{value}</span> : value;
  const content = (
    <>
      <div className="font-mono text-xs font-semibold text-ink-soft uppercase tracking-[0.08em]">{label}</div>
      <div>{valueNode}</div>
      {hint ? <div className="font-mono text-xs text-ink-soft mt-1">{hint}</div> : null}
    </>
  );
  const baseClass = "bg-panel border border-line rounded-card px-[18px] pt-[18px] pb-4 relative overflow-hidden";
  const accentClass = tone === 'confirmed' ? 'bg-green-soft' : 'bg-honey-soft';
  const inner = (
    <>
      <span aria-hidden className={['hex absolute top-3.5 right-3.5 w-3.5 h-4', accentClass].join(' ')} />
      {content}
    </>
  );
  return link ? <Link href={link} className={baseClass}>{inner}</Link> : <section className={baseClass}>{inner}</section>;
}