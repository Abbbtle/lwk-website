import { CircleHelp } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** A small "learn more" link to a help article, for use next to forms and features. */
export function HelpLink({
  slug,
  children,
  className = '',
}: {
  slug: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/help/${slug}`}
      className={`inline-flex items-center gap-1 text-sm font-semibold text-gray-700 underline decoration-gray-400 underline-offset-2 hover:text-brand-ink ${className}`}
    >
      <CircleHelp className="size-4 shrink-0" aria-hidden />
      {children}
    </Link>
  );
}
