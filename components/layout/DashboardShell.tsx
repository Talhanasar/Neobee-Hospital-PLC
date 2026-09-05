'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { isDemoClient } from '@/data/demo/client';
import { signOutAction } from '@/app/[locale]/(auth)/login/actions';
import { HexAvatar } from '@/components/ui/bits';
import { BrandLogo } from '@/components/ui/BrandLogo';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import {
  BadgeCheckIcon,
  FilePlus2Icon,
  HandshakeIcon,
  LayoutDashboardIcon,
  LandmarkIcon,
  LogOutIcon,
  MenuIcon,
  ReceiptTextIcon,
  SettingsIcon,
  UserRoundIcon,
  WalletIcon,
  XIcon,
} from '@/components/ui/icons';

export type DashZone = 'investor' | 'admin';
export type DashIdentity = { name: string; role: 'investor' | 'staff'; initials: string };

const NAV: Record<DashZone, { href: string; key: string; icon: (p: { size?: number }) => React.ReactElement }[]> = {
  investor: [
    { href: '/portal', key: 'overview', icon: LayoutDashboardIcon },
    { href: '/portal/invest', key: 'investments', icon: WalletIcon },
    { href: '/portal/certificates', key: 'certificates', icon: BadgeCheckIcon },
    { href: '/portal/receipts', key: 'receipts', icon: ReceiptTextIcon },
    { href: '/portal/account', key: 'account', icon: LandmarkIcon },
    { href: '/portal/password', key: 'password', icon: UserRoundIcon },
  ],
  admin: [
    { href: '/admin', key: 'dashboard', icon: LayoutDashboardIcon },
    { href: '/admin/register', key: 'register', icon: FilePlus2Icon },
    { href: '/admin/registrations', key: 'registrations', icon: UserRoundIcon },
    { href: '/admin/requests', key: 'requests', icon: ReceiptTextIcon },
    { href: '/admin/leads', key: 'leads', icon: HandshakeIcon },
    { href: '/admin/settings', key: 'settings', icon: SettingsIcon },
    { href: '/admin/password', key: 'password', icon: UserRoundIcon },
  ],
};

function isActive(pathname: string, href: string): boolean {
  return href === '/portal' || href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The shared dashboard shell — one sidebar pattern for the investor portal
 * and the admin console, ported from the reference design: brand block +
 * zone chip, icon nav (amber pill when active), identity + language +
 * logout at the bottom. Desktop sidebar ≥900px; drawer below.
 */
export default function DashboardShell({
  zone,
  identity,
  newLeads = 0,
  pendingRegistrations = 0,
  children,
}: {
  zone: DashZone;
  identity: DashIdentity;
  newLeads?: number;
  pendingRegistrations?: number;
  children: React.ReactNode;
}) {
  const t = useTranslations('dash');
  const navT = useTranslations(zone === 'investor' ? 'portal' : 'admin');
  const brandT = useTranslations('brand');
  const commonT = useTranslations('common');
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Close the drawer on navigation (render-time adjustment pattern).
  const [prevPath, setPrevPath] = React.useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
  }

  const zoneLabel = zone === 'investor' ? t('zoneInvestor') : t('zoneAdmin');
  const roleLabel = identity.role === 'investor' ? t('roleInvestor') : t('roleStaff');
  const items = NAV[zone];

  const sideContent = (onNavigate?: () => void) => (
    <>
      <div className="border-b border-line p-5">
        <Link
          href="/"
          onClick={onNavigate}
          aria-label={navHomeLabel(commonT)}
          className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
        >
          <BrandLogo size={32} />
          <span className="text-left leading-none">
            <span className="block font-display text-[15px] font-bold tracking-tight text-ink">{brandT('name')}</span>
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.24em] text-honey-deep">{brandT('suffix')}</span>
          </span>
        </Link>
        <span className="mt-3 inline-flex rounded-md bg-honey-soft px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-honey-deep">
          {zoneLabel}
        </span>
      </div>

      <nav aria-label={zoneLabel} className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const badge =
            zone === 'admin' && item.href === '/admin/leads' && newLeads > 0
              ? newLeads
              : zone === 'admin' && item.href === '/admin/registrations' && pendingRegistrations > 0
                ? pendingRegistrations
                : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2',
                active ? 'bg-honey-soft font-semibold text-honey-deep' : 'text-ink-soft hover:bg-honey-soft/50 hover:text-ink',
              ].join(' ')}
            >
              <Icon size={18} />
              <span className="flex-1 text-left">{navT(item.key)}</span>
              {badge !== null ? (
                <span aria-label={`${badge} ${t('newLeadsAria')}`} className="rounded-full bg-amber px-2 py-0.5 font-mono text-[10px] font-semibold tnum text-panel">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          <HexAvatar initials={identity.initials} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{identity.name}</p>
            <p className="text-xs text-ink-soft">{roleLabel}</p>
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <LanguageSwitcher />
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-panel text-sm font-semibold text-ink transition-colors hover:border-honey hover:bg-honey-soft/60 focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
          >
            <LogOutIcon size={15} />
            {commonT('logOut')}
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-panel min-[900px]:flex">
        {sideContent()}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-line bg-paper/90 px-4 backdrop-blur min-[900px]:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={commonT('menu')}
              aria-expanded={open}
              className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel text-ink transition-colors hover:border-honey focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
            >
              <MenuIcon size={18} />
            </button>
            <BrandLogo size={26} />
            <span className="font-display text-sm font-bold text-ink">{brandT('name')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-md bg-honey-soft px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-honey-deep sm:inline-flex">
              {zoneLabel}
            </span>
            <LanguageSwitcher />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>

        <footer className="no-print mt-auto border-t border-line px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
            <p>{commonT('rights', { year: String(new Date().getFullYear()) })}</p>
            {isDemoClient() ? <p className="font-mono uppercase tracking-wider">{t('demoData')}</p> : null}
          </div>
        </footer>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 min-[900px]:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/30"
            aria-label={commonT('close')}
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-panel">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={commonT('close')}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-honey-soft/60 hover:text-ink"
            >
              <XIcon size={17} />
            </button>
            {sideContent(() => setOpen(false))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function navHomeLabel(commonT: (k: string) => string) {
  return commonT('home');
}
