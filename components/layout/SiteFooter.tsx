import { getTranslations } from "next-intl/server";

export default async function SiteFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="no-print border-t border-line py-6 text-sm text-ink-soft">
      <div className="shell space-y-2">
        <p>{t("deposits")}</p>
        <p>{t("partner")}</p>
      </div>
    </footer>
  );
}
