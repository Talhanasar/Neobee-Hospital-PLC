"use client";

import Link from "next/link";

import { useLang } from "@/lib/i18n/LanguageProvider";

export default function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="mt-12 border-t border-line bg-panel">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[12.5px] text-ink-soft">
        <span className="font-display font-bold text-ink">
          {t("footer.brand")}
        </span>
        <div className="flex items-center gap-4">
          <span>{t("footer.digitalBy")}</span>
          <Link
            href="/admin/login"
            className="font-semibold text-ink-soft transition-colors hover:text-ink"
          >
            {t("footer.admin")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
