import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export default async function AuthLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return (
    <div className="min-h-screen">
      <div className="shell flex justify-start py-5">
        <Link href="/" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink hover:border-ink">
          <span aria-hidden="true" className="hex h-[16px] w-[14px] bg-honey" />
          {t('backToHome')}
        </Link>
      </div>
      <main className="shell flex flex-col items-center pb-16 pt-8">
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  );
}
