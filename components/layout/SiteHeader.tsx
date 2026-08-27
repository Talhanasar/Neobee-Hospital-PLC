import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSessionContext } from "@/lib/auth";
import NavPills from "./NavPills";
import LanguageSwitcher from "./LanguageSwitcher";

type Props = { session: Awaited<ReturnType<typeof getSessionContext>>; locale: string };

export default async function SiteHeader({ session, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "meta" });

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-panel">
      <div className="shell flex flex-wrap items-center gap-4 py-3 md:flex-nowrap md:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span aria-hidden="true" className="hex h-[25px] w-[22px] bg-honey" />
          <span className="font-display text-[18px] font-bold tracking-[-0.01em]">{t("title")}</span>
        </Link>
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
          <NavPills auth={{ loggedIn: session.user !== null, dashboardHref: session.isStaff ? "/admin" : "/portal" }} />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
