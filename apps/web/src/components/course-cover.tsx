import Image from 'next/image';

// POC photos used as category artwork and as the cover of courses without their own image.
export const categoryImages: Record<string, { src: string; alt: string }> = {
  kirtan: { src: '/images/hero-kirtan.jpg', alt: 'A kirtan leader singing with devotees' },
  prasadam: { src: '/images/hero-prasadam.jpg', alt: 'A prasadam feast laid out on leaves' },
  'vaisnava-etiquette': {
    src: '/images/hero-devotion.jpg',
    alt: 'Devotees gathered in kirtan around a garlanded seat',
  },
  'sastra-study': { src: '/images/hero-sastra.jpg', alt: 'Volumes of Vedic literature' },
};
const fallback = categoryImages['vaisnava-etiquette'];

export function CourseCover({
  categorySlug,
  imageUrl,
  className = '',
  sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
}: {
  categorySlug: string;
  /** Uploaded cover image; falls back to the category photo. */
  imageUrl?: string | null;
  className?: string;
  sizes?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed S3 URL
      <img src={imageUrl} alt="" className={`aspect-video w-full object-cover ${className}`} />
    );
  }
  const image = categoryImages[categorySlug] ?? fallback;
  return (
    <div className={`relative aspect-video w-full overflow-hidden bg-gray-200 ${className}`}>
      <Image src={image.src} alt="" fill sizes={sizes} className="object-cover" />
    </div>
  );
}
