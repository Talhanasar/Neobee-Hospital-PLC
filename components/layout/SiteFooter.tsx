import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { HexLogo } from '@/components/ui/bits';
import { FlaskConicalIcon, MailIcon, MapPinIcon, PhoneIcon } from '@/components/ui/icons';
import { getSessionContext } from '@/lib/auth';

type Props = { session: Awaited<ReturnType<typeof getSessionContext>> };

const heading = 'font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft';
const link = 'text-sm text-ink-soft transition-colors hover:text-honey-deep focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2';

export default async function SiteFooter({ session }: Props) {
  const [tbrand, tnav, tfoot] = await Promise.all([
    getTranslations('brand'),
    getTranslations('nav'),
    getTranslations('footer'),
  ]);

  const dashboardHref = session.isStaff ? '/admin' : '/portal';

  return (
    <footer className="no-print mt-auto border-t border-line bg-panel">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <HexLogo size={34} />
            <span className="leading-none">
              <span className="block font-display text-[17px] font-bold tracking-tight text-ink">{tbrand('name')}</span>
              <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.24em] text-honey-deep">{tbrand('suffix')}</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">{tfoot('tagline')}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-ink-soft">
            <FlaskConicalIcon size={12} className="text-honey-deep" aria-hidden="true" />
            {tfoot('depositsShort')}
          </span>
        </div>

        <nav aria-label={tfoot('explore')}>
          <p className={heading}>{tfoot('explore')}</p>
          <ul className="mt-4 space-y-2.5">
            <li><Link href="/" className={link}>{tnav('home')}</Link></li>
            <li><Link href="/about" className={link}>{tnav('about')}</Link></li>
            <li><Link href="/gallery" className={link}>{tnav('gallery')}</Link></li>
          </ul>
        </nav>

        <nav aria-label={tfoot('utility')}>
          <p className={heading}>{tfoot('utility')}</p>
          <ul className="mt-4 space-y-2.5">
            <li><Link href="/interest" className={link}>{tfoot('join')}</Link></li>
            <li><Link href="/verify" className={link}>{tnav('verify')}</Link></li>
            <li>
              <Link
                href={session.user ? dashboardHref : '/login'}
                className={link}
              >
                {session.user ? tnav('dashboard') : tnav('login')}
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <p className={heading}>{tfoot('contact')}</p>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
            <li className="flex items-start gap-2">
              <MapPinIcon size={15} className="mt-0.5 shrink-0 text-honey-deep" aria-hidden="true" />
              {tfoot('address')}
            </li>
            <li className="flex items-start gap-2">
              <MailIcon size={15} className="mt-0.5 shrink-0 text-honey-deep" aria-hidden="true" />
              <span className="font-mono text-xs">{tfoot('email')}</span>
            </li>
            <li className="flex items-start gap-2">
              <PhoneIcon size={15} className="mt-0.5 shrink-0 text-honey-deep" aria-hidden="true" />
              <span className="font-mono text-xs">{tfoot('phone')}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <p className="text-xs text-ink-soft">{tfoot('rights', { year: new Date().getFullYear() })}</p>
          <p className="text-xs text-ink-soft">{tfoot('partner')}</p>
        </div>
      </div>
    </footer>
  );
}
