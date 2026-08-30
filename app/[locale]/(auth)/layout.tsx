import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronLeftIcon } from '@/components/ui/icons';

export default async function AuthLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return (
    <div className="hex-bg min-h-screen">
      <div className="mx-auto flex max-w-6xl justify-start px-4 py-5 sm:px-6">
        <Link href="/" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink transition-colors hover:border-honey focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2">
          <ChevronLeftIcon size={17} className="text-honey-deep" />
          {t('backToHome')}
        </Link>
      </div>
      <main className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-16 pt-8 sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
