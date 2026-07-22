import DashboardHeader from "@/components/DashboardHeader";
import SiteFooter from "@/components/SiteFooter";
import { getCurrentAdmin, signOut } from "@/lib/auth";

/**
 * Layout for everything under `/admin`.
 *
 * Uses the non-redirecting `getCurrentAdmin()` (NOT `requireAdmin()`) on
 * purpose: the public admin-auth pages (`/admin/login`, `/admin/forgot`,
 * `/admin/reset`) live under this segment and must stay reachable while
 * logged out. When no admin session exists we render just `{children}` so
 * those pages show their own header/footer. When an admin is signed in we
 * wrap the authenticated pages (dashboard, add, security, edit) in the
 * shared authenticated chrome: DashboardHeader + SiteFooter.
 *
 * The authenticated pages themselves still call `requireAdmin()` for the
 * actual access gate; this layout only decides which chrome to render.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return <>{children}</>;
  }

  return (
    <>
      <DashboardHeader identityLabel={admin.email} signOutAction={signOut} />
      {children}
      <SiteFooter />
    </>
  );
}
