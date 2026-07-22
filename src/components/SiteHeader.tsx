"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/LanguageProvider";
import LanguageSwitcher from "./LanguageSwitcher";

/**
 * Sticky site header. Renders the brand, primary nav, and the EN/BN toggle.
 * Client component so the nav labels react to the language context.
 */
export default function SiteHeader() {
  const { t } = useLang();

  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3 sm:gap-4">
        <Link href="/" className="flex items-center gap-3">
          <HexMark />
          <div className="leading-tight">
            <div className="font-display text-[17px] font-extrabold tracking-tight">
              {t("common.neobeeHospitalPlc")}
            </div>
            <div className="font-mono text-[10.5px] tracking-[0.14em] text-ink-soft uppercase">
              {t("common.stakeholderFinancePortal")}
            </div>
          </div>
        </Link>

        <nav
          aria-label="Primary"
          className="order-3 flex w-full gap-1 rounded-full border border-line bg-panel/70 p-1 sm:order-2 sm:ml-auto sm:w-auto"
        >
          <NavLink href="/" label={t("nav.project")} />
          <NavLink href="/verify" label={t("nav.verify")} />
        </nav>

        <Link
          href="/login"
          className="order-4 inline-flex items-center justify-center rounded-full bg-honey px-4 py-1.5 font-display text-[13px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep sm:order-4"
          aria-label={t("nav.signin")}
        >
          {t("nav.signin")}
        </Link>

        <div className="order-2 ml-auto sm:order-3 sm:ml-0">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink"
    >
      {label}
    </Link>
  );
}

function HexMark() {
  return (
    <svg
      viewBox="0 0 38 42"
      aria-hidden="true"
      className="h-9 w-[34px] flex-none"
    >
      <polygon points="19,1 36,11 36,31 19,41 2,31 2,11" className="fill-honey" />
      <polygon
        points="19,8 30,14.5 30,27.5 19,34 8,27.5 8,14.5"
        className="fill-ink"
      />
      <text
        x="19"
        y="26"
        textAnchor="middle"
        fontFamily="var(--font-archivo), sans-serif"
        fontWeight="800"
        fontSize="13"
        className="fill-honey"
      >
        N
      </text>
    </svg>
  );
}
