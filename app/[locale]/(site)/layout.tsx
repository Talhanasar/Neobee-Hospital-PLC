import { getTranslations } from 'next-intl/server';
import { getSessionContext } from '@/lib/auth';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import BackToTop from '@/components/layout/BackToTop';

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export default async function SiteLayout({ children }: Props) {
  const [session, t] = await Promise.all([getSessionContext(), getTranslations('common')]);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:h-10 focus:rounded-xl focus:border focus:border-line focus:bg-panel focus:px-4 focus:text-sm focus:font-semibold focus:text-ink"
      >
        {t('skipToContent')}
      </a>
      <SiteHeader session={session} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter session={session} />
      <BackToTop />
    </div>
  );
}
