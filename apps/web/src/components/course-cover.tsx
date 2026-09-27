import {
  BookOpen,
  CookingPot,
  GraduationCap,
  HandHeart,
  Music,
  type LucideIcon,
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  kirtan: Music,
  prasadam: CookingPot,
  'vaisnava-etiquette': HandHeart,
  'sastra-study': BookOpen,
};

// Category artwork, used when a course has no uploaded cover image.
export function CourseCover({
  categorySlug,
  imageUrl,
  className = '',
}: {
  categorySlug: string;
  /** Uploaded cover image; falls back to the category artwork. */
  imageUrl?: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed S3 URL
      <img src={imageUrl} alt="" className={`aspect-video w-full object-cover ${className}`} />
    );
  }
  const Icon = icons[categorySlug] ?? GraduationCap;
  return (
    <div
      aria-hidden
      className={`flex aspect-video items-center justify-center bg-gray-100 text-brand ${className}`}
    >
      <Icon className="size-1/4" strokeWidth={1.25} />
    </div>
  );
}
