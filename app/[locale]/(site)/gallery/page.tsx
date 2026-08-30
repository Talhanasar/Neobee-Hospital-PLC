import { getTranslations } from 'next-intl/server';
import GalleryClient from '@/components/gallery/GalleryClient';

export const dynamic = 'force-dynamic';

export default async function GalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await getTranslations({ locale, namespace: 'gallery' });

  return <GalleryClient />;
}
