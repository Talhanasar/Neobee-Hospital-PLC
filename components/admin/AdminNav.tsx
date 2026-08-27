'use client';

import { useTranslations } from 'next-intl';
import { usePathname, Link } from '@/i18n/navigation';
const items = [
  { href: '/admin', key: 'dashboard' }, 
  { href: '/admin/register', key: 'register' }, 
  { href: '/admin/requests', key: 'requests' }, 
  { href: '/admin/settings', key: 'settings' }
] as const;
export function AdminNav() { 
  const pathname = usePathname(); 
  const t = useTranslations('admin'); 
  return <nav className="bg-paper border border-line rounded-full p-1 inline-flex gap-1 flex-wrap">{items.map((item) => { const active = pathname === item.href; return <Link key={item.href} href={item.href} className={['rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors', active ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'].join(' ')}>{t(item.key)}</Link>; })}</nav>; 
}
