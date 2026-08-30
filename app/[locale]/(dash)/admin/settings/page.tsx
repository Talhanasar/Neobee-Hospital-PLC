export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { SettingsForm } from '@/components/admin/SettingsForm';

export default async function AdminSettingsPage() {
  await requireStaff();
  const t = await getTranslations('admin');
  const settings = await getSettings();
  return <div className="space-y-4"><div><h2 className="font-display text-2xl font-bold">{t('settingsTitle')}</h2><p className="text-ink-soft">{t('settingsLead')}</p></div><SettingsForm settings={settings} /></div>;
}
