import { getTranslations } from 'next-intl/server';

const tiles = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] as const;

export default async function GalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'gallery' });

  return (
    <div className="py-16 md:py-24 space-y-6">
      <section className="space-y-3">
        <h1 className="font-display text-[38px] font-bold leading-tight">{t('title')}</h1>
        <p className="max-w-[620px] text-ink-soft">{t('lead')}</p>
      </section>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-4">
        {tiles.map((key) => (
          <figure key={key} className="overflow-hidden rounded-card border border-line bg-panel">
            {/* Placeholder slot for a real photo; swap the inner div for next/image when assets exist. */}
            <div className="flex aspect-[4/3] items-center justify-center rounded-card border-2 border-dashed border-line bg-honey-soft">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">{t('emptyTileCaption')}</span>
            </div>
            <figcaption className="space-y-0.5 border-t border-line px-4 py-3 text-sm">
              <div className="font-semibold">{t(key)}</div>
              <div className="text-xs text-ink-soft">{t('tileHint')}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
