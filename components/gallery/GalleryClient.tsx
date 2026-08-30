'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Btn } from '@/components/ui/bits';
import { Reveal } from '@/components/ui/Reveal';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from '@/components/ui/icons';
import { GALLERY, GALLERY_FILTERS, type GalleryFilter } from '@/lib/gallery';

/** One grid tile — image fades in over a soft shimmer once decoded. */
function GalleryTile({
  src,
  caption,
  categoryLabel,
  eager,
  onOpen,
}: {
  src: string;
  caption: string;
  categoryLabel: string;
  eager: boolean;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="nb-card group block h-full w-full cursor-pointer overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
    >
      <div className="relative h-52 w-full overflow-hidden bg-honey-soft/40">
        {!loaded ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 animate-pulse bg-gradient-to-br from-honey-soft/70 via-paper to-honey-soft/40"
          />
        ) : null}
        <Image
          src={src}
          alt={caption}
          width={1344}
          height={768}
          loading={eager ? 'eager' : 'lazy'}
          priority={eager}
          onLoad={() => setLoaded(true)}
          className={`img-fade h-52 w-full object-cover transition-all duration-300 group-hover:scale-[1.03] ${loaded ? 'img-loaded' : ''}`}
        />
      </div>
      <div className="p-4">
        <p className="text-sm font-medium text-ink">{caption}</p>
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
          {categoryLabel.toUpperCase()}
        </p>
      </div>
    </button>
  );
}

export default function GalleryClient() {
  const t = useTranslations('gallery');

  const filterLabels: Record<GalleryFilter, string> = {
    all: t('filterAll'),
    site: t('categorySite'),
    render: t('categoryRenderings'),
    event: t('categoryEvents'),
  };

  const [filter, setFilter] = React.useState<GalleryFilter>('all');
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  const filtered = filter === 'all' ? GALLERY : GALLERY.filter((g) => g.category === filter);
  const active = filtered[index];
  const captionOf = (i: number) => t(filtered[i]?.captionKey ?? 'title');

  const pickFilter = (f: GalleryFilter) => {
    if (f === filter) return;
    setFilter(f);
    setIndex(0);
    setOpen(false);
  };

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  const prev = () => setIndex((i) => (i - 1 + filtered.length) % filtered.length);
  const next = () => setIndex((i) => (i + 1) % filtered.length);

  /* Escape closes the lightbox. */
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* 1 · HEAD */}
        <Reveal>
          <p className="nb-kicker flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 bg-honey hex-clip" />
            {t('title')}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">{t('galleryHeading')}</h1>
          <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">{t('note')}</p>
        </Reveal>

        {/* 2 · FILTER CHIPS */}
        <div role="group" aria-label={t('filterLabel')} className="mt-8 flex flex-wrap gap-2.5">
          {GALLERY_FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => pickFilter(id)}
              className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2 ${
                filter === id
                  ? 'border-honey bg-honey text-ink'
                  : 'border-line bg-panel text-ink-soft hover:border-honey hover:text-ink'
              }`}
            >
              {filterLabels[id]}
            </button>
          ))}
        </div>

        {/* 3 · GRID */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, i) => (
            <GalleryTile
              key={item.src}
              src={item.src}
              caption={t(item.captionKey)}
              categoryLabel={filterLabels[item.category]}
              eager={i < 3}
              onOpen={() => openAt(i)}
            />
          ))}
        </div>
      </div>

      {/* 4 · LIGHTBOX */}
      {open && active ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={captionOf(index)}
            className="nb-card w-full max-w-3xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <Image
                src={active.src}
                alt={captionOf(index)}
                width={1344}
                height={768}
                className="max-h-[70vh] w-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('close')}
                className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full border border-line bg-panel/90 text-ink transition-colors hover:border-honey focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2"
              >
                <XIcon size={16} />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 px-1 pb-1">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{captionOf(index)}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                  {filterLabels[active.category].toUpperCase()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Btn variant="ghost" size="sm" onClick={prev} aria-label={t('prev')} className="focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2">
                  <ChevronLeftIcon size={18} aria-hidden="true" />
                </Btn>
                <span className="num px-1 text-xs text-ink-soft">{`${index + 1}/${filtered.length}`}</span>
                <Btn variant="ghost" size="sm" onClick={next} aria-label={t('next')} className="focus-visible:outline-2 focus-visible:outline-honey-deep focus-visible:outline-offset-2">
                  <ChevronRightIcon size={18} aria-hidden="true" />
                </Btn>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
