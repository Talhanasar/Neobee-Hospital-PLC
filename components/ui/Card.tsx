export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={['bg-panel border border-line rounded-card overflow-hidden', className].filter(Boolean).join(' ')}>{children}</section>;
}

export function CardHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={['px-5 py-4 border-b border-line flex items-center gap-3 flex-wrap', className].filter(Boolean).join(' ')}>{children}</div>;
}
