export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { RegisterForm } from '@/components/admin/RegisterForm';

export default async function RegisterPage() {
  await requireStaff();
  const t = await getTranslations('admin');
  const settings = await getSettings();
  return <div className="space-y-4"><div><h2 className="font-display text-2xl font-bold">{t('registerTitle')}</h2><p className="text-ink-soft">{t('registerLead')}</p></div><RegisterForm sharePrice={settings.SHARE_PRICE} incentivePerShare={settings.INCENTIVE_PER_SHARE} /></div>;
}
