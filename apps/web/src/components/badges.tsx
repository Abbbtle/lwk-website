import { FileText, Headphones, type LucideIcon, Newspaper, PlayCircle } from 'lucide-react';

const badge = 'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold uppercase';

/** Free for everyone. */
export function FreeBadge({ className = '' }: { className?: string }) {
  return <span className={`${badge} bg-brand text-white ${className}`}>Free</span>;
}

/** Sample content used for testing; removed before launch. */
export function SampleBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Sample content used to test the platform"
      className={`${badge} border border-dashed border-gray-500 bg-white text-gray-700 ${className}`}
    >
      Sample
    </span>
  );
}

export const resourceTypes: Record<
  'VIDEO' | 'AUDIO' | 'ARTICLE' | 'PDF',
  { label: string; icon: LucideIcon; unit: string }
> = {
  VIDEO: { label: 'Video', icon: PlayCircle, unit: 'watch' },
  AUDIO: { label: 'Audio', icon: Headphones, unit: 'listen' },
  ARTICLE: { label: 'Article', icon: Newspaper, unit: 'read' },
  PDF: { label: 'PDF', icon: FileText, unit: 'read' },
};

export function TypeBadge({
  type,
  className = '',
}: {
  type: keyof typeof resourceTypes;
  className?: string;
}) {
  const { label, icon: Icon } = resourceTypes[type];
  return (
    <span className={`${badge} bg-black text-white ${className}`}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
