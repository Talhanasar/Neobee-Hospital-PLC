import DashboardHeader from "@/components/DashboardHeader";
import SiteFooter from "@/components/SiteFooter";
import { requireStakeholder, signOut } from "@/lib/auth";

/**
 * Layout for the authenticated stakeholder dashboard. Resolves the stakeholder
 * (also gating access) and renders the shared authenticated header above the
 * page content, with the site footer below.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const stakeholder = await requireStakeholder();

  return (
    <>
      <DashboardHeader identityLabel={stakeholder.name} signOutAction={signOut} />
      {children}
      <SiteFooter />
    </>
  );
}
