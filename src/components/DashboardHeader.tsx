/**
 * Authenticated-area header used by the admin/stakeholder dashboard layouts.
 *
 * Distinct from the public `SiteHeader`:
 *   - `SiteHeader` carries the public marketing nav (Project / Verify) and a
 *     Sign-in CTA.
 *   - `DashboardHeader` instead shows the brand lockup, language switcher,
 *     the signed-in identity (email / stakeholder name), and a Log out button.
 *
 * The `signOut` server action (from `@/lib/auth`) is passed in as a prop rather
 * than imported directly, so this file can stay a client component while still
 * submitting to the server action via a `<form action={...}>`.
 */
"use client";

import LogoMark from "@/components/LogoMark";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLang } from "@/lib/i18n/LanguageProvider";

type DashboardHeaderProps = {
  identityLabel: string;
  signOutAction: () => void;
};

export default function DashboardHeader({
  identityLabel,
  signOutAction,
}: DashboardHeaderProps) {
  const { t } = useLang();

  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div className="leading-tight">
            <div className="font-display text-[17px] font-extrabold tracking-tight">
              {t("common.neobeeHospitalPlc")}
            </div>
            <div className="font-mono text-[10.5px] tracking-[0.14em] text-ink-soft uppercase">
              {t("common.stakeholderFinancePortal")}
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <LanguageSwitcher />

          <span
            translate="no"
            className="hidden text-[13px] font-medium text-ink-soft sm:inline"
          >
            {identityLabel}
          </span>

          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full border border-line bg-panel px-5 py-2 text-[13px] font-semibold text-ink-soft transition-[color,border-color,background-color,transform] duration-200 ease-out cursor-pointer hover:border-ink hover:text-ink active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              {t("nav.signout")}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
