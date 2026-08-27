import * as React from 'react';

export type ButtonProps = { variant?: 'default' | 'primary'; size?: 'md' | 'sm' } & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function buttonClasses(variant: 'default' | 'primary' = 'default', size: 'md' | 'sm' = 'md') {
  // base holds only structural/typography/focus utilities. No colour is
  // declared here so variants own background, border-colour, text and hover
  // entirely (Tailwind v4 decides colour by generated-CSS source order, so a
  // duplicate utility anywhere would race the variant's intent).
  const base = 'inline-flex items-center justify-center border rounded-lg font-semibold focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';
  const sizes = size === 'sm' ? 'px-[9px] py-[5px] text-xs' : 'px-3 py-[7px] text-[13px]';
  const variants = variant === 'primary'
    ? 'bg-honey border-honey text-ink hover:bg-honey-deep hover:border-honey'
    : 'bg-panel border-line text-ink hover:border-ink';
  return [base, sizes, variants].filter(Boolean).join(' ');
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'default', size = 'md', className, ...props }, ref) {
  return <button ref={ref} className={[buttonClasses(variant, size), className].filter(Boolean).join(' ')} {...props} />;
});
