export function Num({ value, className }: { value: number | string; className?: string }) {
  return <span className={['num', className].filter(Boolean).join(' ')}>{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</span>;
}
