'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { signOutAction } from '@/app/[locale]/(auth)/login/actions';

const items = [{ href: '/', key: 'home' }, { href: '/about', key: 'about' }, { href: '/gallery', key: 'gallery' }, { href: '/verify', key: 'verify' }] as const;

export type NavAuth = { loggedIn: boolean; dashboardHref: string };

// Existing NavPills tokens: ink-on-paper pills, honey focus ring, primary = solid honey.
const focusRing = 'focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';
const pillBase = `inline-flex items-center justify-center rounded-full px-3.5 py-2 text-[13px] font-semibold ${focusRing}`;
const pillIdle = `${pillBase} text-ink-soft hover:text-ink`;
const pillActive = `${pillBase} bg-ink text-white`;
const pillPrimary = `inline-flex items-center justify-center rounded-full border border-honey bg-honey px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-honey-deep ${focusRing}`;

export default function NavPills({ auth }: { auth: NavAuth }) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  return (
    <div className="relative flex w-full flex-wrap items-start justify-end gap-2 md:w-auto md:flex-nowrap md:items-center">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="site-nav-menu" aria-label={t('menu')} className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper text-ink hover:border-ink ${focusRing} md:hidden`}>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <><path d="M4 4l12 12" /><path d="M16 4L4 16" /></> : <><path d="M3 5.5h14" /><path d="M3 10h14" /><path d="M3 14.5h14" /></>}
        </svg>
      </button>
      {open && (
        <div
          className="fixed inset-0 bg-ink/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <div id="site-nav-menu" className={[open ? 'flex' : 'hidden', 'fixed inset-x-0 top-full z-50 flex-col items-stretch gap-2 overflow-y-auto p-4 shadow-lg md:relative md:z-auto md:m-0 md:w-auto md:flex-row md:items-center md:gap-1 md:rounded-full md:border md:border-line md:bg-paper md:p-1'].filter(Boolean).join(' ')}>
        <nav aria-label={t('primaryAriaLabel')} className="flex flex-col gap-0.5 rounded-card border border-line bg-paper p-1 md:flex-row md:flex-wrap md:gap-1 md:rounded-full">
          {items.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <Link key={item.key} href={item.href} onClick={() => setOpen(false)} className={active ? pillActive : pillIdle} aria-current={active ? 'page' : undefined}>{t(item.key)}</Link>;
          })}
        </nav>
        <div className="flex flex-wrap items-center gap-1 rounded-card border border-line bg-paper p-1 md:rounded-full">
          {auth.loggedIn ? (
            <>
              <Link href={auth.dashboardHref} onClick={() => setOpen(false)} className={pillPrimary}>{t('dashboard')}</Link>
              <form action={signOutAction}>
                <button type="submit" className={`${pillIdle} border border-transparent hover:border-ink`}>{t('logout')}</button>
              </form>
            </>
          ) : (
            <Link href="/register" className={pillPrimary}>{t('register')}</Link>
          )}
        </div>
      </div>
    </div>
  );
}
