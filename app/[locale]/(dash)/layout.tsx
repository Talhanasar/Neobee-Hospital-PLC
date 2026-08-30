export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { getSessionContext } from '@/lib/auth';

/**
 * Auth gate for both dashboard zones. Zone-specific shells (sidebar with
 * the right nav, identity, badges) live in portal/layout.tsx and
 * admin/layout.tsx — App Router layouts get no pathname.
 */
export default async function DashLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSessionContext();
  if (!session.user) redirect({ href: '/login', locale });
  return children;
}
