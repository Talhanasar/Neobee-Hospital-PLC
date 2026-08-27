import { getSessionContext } from "@/lib/auth";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export default async function SiteLayout({ children, params }: Props) {
  const { locale } = await params;
  const session = await getSessionContext();

  return (
    <>
      <SiteHeader session={session} locale={locale} />
      <main className="shell py-6">{children}</main>
      <SiteFooter />
    </>
  );
}
