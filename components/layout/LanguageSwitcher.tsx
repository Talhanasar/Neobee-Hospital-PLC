"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/** Two-way EN/BN toggle — a segmented control, never a dropdown. */
export default function LanguageSwitcher({ className }: { className?: string }) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("common");

  const focusRing =
    "focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2";

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={`inline-flex items-center rounded-full border border-line bg-panel p-0.5 ${className ?? ""}`}
    >
      {(["en", "bn"] as const).map((loc) => {
        const selected = locale === loc;
        const label = loc === "en" ? t("english") : t("bangla");
        const short = loc === "en" ? "EN" : "বাং";
        return (
          <Link
            key={loc}
            href={pathname}
            locale={loc}
            hrefLang={loc}
            aria-label={label}
            aria-current={selected ? "true" : undefined}
            className={`inline-flex h-8 min-w-11 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors ${focusRing} ${
              selected ? "bg-honey text-ink" : "text-ink-soft hover:text-ink"
            }`}
          >
            <span lang={loc}>{short}</span>
          </Link>
        );
      })}
    </div>
  );
}
