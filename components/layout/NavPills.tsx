'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import { HexLogo } from '@/components/ui/bits';
import { MenuIcon, XIcon } from '@/components/ui/icons';

export type NavAuth = { loggedIn: boolean; dashboardHref: string };

const LINKS = [
  { href: '/', key: 'home' },
  { href: '/about', key: 'about' },
  { href: '/gallery', key: 'gallery' },
] as const;

/**
 * The marketing navigation, ported from the reference design: hexagon
 * brand mark, pill links (honey-soft when active), segmented language
 * switcher and one auth-aware button (Login / Dashboard).
 */
export default function NavPills({ auth }: { auth: NavAuth }) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [open, setOpen] = React.useState(false);

  /* Close the mobile panel whenever the route changes (render-time
     state adjustment — the React-recommended pattern). */
  const [prevPath, setPrevPath] = React.useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
  }

  const linkCls = (active: boolean) =>
    `rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2 ${
      active ? 'bg-honey-soft text-honey-deep' : 'text-ink-soft hover:bg-honey-soft/50 hover:text-ink'
    }`;

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <nav aria-label={t('primaryAriaLabel')} className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label={t('home')} className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2">
          <HexLogo size={34} />
          <span className="text-left leading-none">
            <span className="block font-display text-[17px] font-bold tracking-tight text-ink">
              <BrandName />
            </span>
            <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.24em] text-honey-deep">
              <BrandSuffix />
            </span>
          </span>
        </Link>

        <div className="hidden min-[760px]:flex items-center gap-1">
          {LINKS.map((l) => {
            const active = l.href === '/' ? pathname === '/' : pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={linkCls(active)}>
                {t(l.key)}
              </Link>
            );
          })}
        </div>

        <div className="hidden min-[760px]:flex items-center gap-2.5">
          <LanguageSwitcher />
          {auth.loggedIn ? (
            <Link href={auth.dashboardHref} className={btnLinkCls}>
              {t('dashboard')}
            </Link>
          ) : (
            <Link href="/login" className={btnLinkCls}>
              {t('login')}
            </Link>
          )}
        </div>

        <div className="flex min-[760px]:hidden items-center gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-nav-menu"
            aria-label={open ? t('close') : t('menu')}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel text-ink transition-colors hover:border-honey focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
          >
            {open ? <XIcon size={18} /> : <MenuIcon size={18} />}
          </button>
        </div>
      </nav>

      {open ? (
        <div id="site-nav-menu" className="animate-menu-in border-t border-line bg-paper px-4 pb-5 pt-3 min-[760px]:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => {
              const active = l.href === '/' ? pathname === '/' : pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={`${linkCls(active)} text-left`}>
                  {t(l.key)}
                </Link>
              );
            })}
            <div className="mt-3">
              {auth.loggedIn ? (
                <Link href={auth.dashboardHref} className={btnLinkCls}>
                  {t('dashboard')}
                </Link>
              ) : (
                <Link href="/login" className={btnLinkCls}>
                  {t('login')}
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

const btnLinkCls =
  'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-honey px-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-honey-deep hover:text-paper focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';

function BrandName() {
  const t = useTranslations('brand');
  return <>{t('name')}</>;
}

function BrandSuffix() {
  const t = useTranslations('brand');
  return <>{t('suffix')}</>;
}
