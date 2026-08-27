export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { AuthError, requireStaff } from '@/lib/auth';
import { AdminNav } from '@/components/admin/AdminNav';
import { getTranslations } from 'next-intl/server';

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try {
    await requireStaff();
  } catch (error) {
    if (error instanceof AuthError) redirect({ href: '/login', locale });
    throw error;
  }
  const t = await getTranslations('admin');
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="font-display text-[34px] font-bold leading-tight">{t('title')}</h1>
        <AdminNav />
      </header>
      {children}
    </div>
  );
}
