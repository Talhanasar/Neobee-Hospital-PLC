import { getTranslations } from 'next-intl/server';
import { formatBdt } from '@/lib/money';

type LedgerLineProps = {
  confirmedAmount: number;
  targetAmount: number;
  registeredCount: number;
  confirmedCount: number;
  updatedAt: string;
  locale: string;
};

const bdt = (amount: number) => `৳${formatBdt(amount)}`;

export async function LedgerLine({ confirmedAmount, targetAmount, registeredCount, confirmedCount, updatedAt, locale }: LedgerLineProps) {
  const t = await getTranslations({ locale, namespace: 'progress' });
  const pct = Math.min(100, (targetAmount > 0 ? (confirmedAmount / targetAmount) * 100 : 0));
  const fill = `${pct}%`;

  // Honey fill is decorative only — the percentage number carries the info.
  return (
    <section className="w-full bg-panel border-y border-line">
      <div className="shell flex flex-col gap-4 md:flex md:flex-row md:items-center md:justify-between md:gap-3 py-4 text-sm">
        {/* Kicker */}
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-soft md:whitespace-nowrap">{t('ledgerKicker')}</span>

        {/* Center: amount + track + percentage + stats — wraps on mobile, single row on md+ */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 min-w-0 md:flex-1">
          <span className="num font-mono text-[17px] font-semibold text-ink whitespace-nowrap">{bdt(confirmedAmount)}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft whitespace-normal md:whitespace-nowrap block md:inline">{t('ledgerAmount', { amount: bdt(confirmedAmount), target: bdt(targetAmount) })}</span>
          <div className="flex-1 h-3 min-w-[60px] bg-line rounded-full overflow-hidden">
            <div className="h-full bg-honey" style={{ width: fill, minWidth: '4px' }} />
          </div>
          <span className="num font-mono text-[13px] font-bold text-ink whitespace-nowrap">{pct.toFixed(1)}%</span>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex flex-col items-center gap-1">
              <span className="num font-mono text-[15px] font-semibold text-ink">{registeredCount.toLocaleString('en-IN')}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">{t('ledgerRegistered')}</span>
            </span>
            <span className="flex flex-col items-center gap-1">
              <span className="num font-mono text-[15px] font-semibold text-ink">{confirmedCount.toLocaleString('en-IN')}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">{t('ledgerConfirmed')}</span>
            </span>
          </div>
        </div>

        {/* Updated timestamp */}
        <span className="font-mono text-[11px] text-ink-soft md:whitespace-nowrap md:text-right">{t('ledgerUpdated', { date: updatedAt })}</span>
      </div>
    </section>
  );
}