/** Gallery inventory — placeholder imagery from the reference prototype,
 *  ready to be replaced with real Neobee photography and renderings.
 *  Captions live in the i18n catalogs (gallery.item1Caption … item8Caption). */
export type GalleryCategory = 'site' | 'render' | 'event';

export interface GalleryItem {
  src: string;
  category: GalleryCategory;
  /** i18n key suffix in the gallery namespace, e.g. "item1Caption". */
  captionKey: string;
}

export const GALLERY: GalleryItem[] = [
  { src: '/images/hospital-hero.png', category: 'render', captionKey: 'item1Caption' },
  { src: '/images/render-lobby.png', category: 'render', captionKey: 'item2Caption' },
  { src: '/images/render-ward.png', category: 'render', captionKey: 'item3Caption' },
  { src: '/images/about-blueprint.png', category: 'render', captionKey: 'item4Caption' },
  { src: '/images/site-aerial.png', category: 'site', captionKey: 'item5Caption' },
  { src: '/images/site-construction.png', category: 'site', captionKey: 'item6Caption' },
  { src: '/images/event-groundbreaking.png', category: 'event', captionKey: 'item7Caption' },
  { src: '/images/event-seminar.png', category: 'event', captionKey: 'item8Caption' },
];

export const GALLERY_FILTERS = ['all', 'site', 'render', 'event'] as const;
export type GalleryFilter = (typeof GALLERY_FILTERS)[number];
