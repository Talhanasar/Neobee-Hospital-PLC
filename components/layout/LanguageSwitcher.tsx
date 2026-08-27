"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("common");

  return (
    <nav aria-label={t("language")} className="rounded-full border border-line bg-paper p-1 flex">
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
            className={
              selected
                ? "rounded-full bg-ink px-3.5 py-2 text-[13px] font-semibold font-body text-white min-w-[56px] inline-flex items-center justify-center"
                : "rounded-full px-3.5 py-2 text-[13px] font-semibold font-body text-ink-soft hover:text-ink min-w-[56px] inline-flex items-center justify-center"
            }
          >
            <span lang={loc}>
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{short}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
