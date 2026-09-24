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

// Placeholder artwork until course images are uploaded (Phase 4).
export function CourseCover({
  categorySlug,
  className = '',
}: {
  categorySlug: string;
  className?: string;
}) {
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
