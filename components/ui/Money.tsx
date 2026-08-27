import { formatBdt } from '@/lib/money';

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={['num', className].filter(Boolean).join(' ')}>৳{formatBdt(value)}</span>;
}
