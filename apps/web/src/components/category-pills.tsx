import Link from 'next/link';
import type { Category } from '@/lib/catalog/types';

export function pillClass(active: boolean) {
  const base = 'shrink-0 whitespace-nowrap rounded-lg border-2 px-4 py-2 font-medium';
  return active
    ? `${base} border-black text-black shadow-[0_3px_0_0_black]`
    : `${base} border-transparent text-gray-600 hover:text-black`;
}

/** A row of filter pills: one swipeable line on phones, wrapping on larger screens. */
export const pillRowClass =
  '-mx-4 flex min-w-0 max-w-[calc(100%+2rem)] gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:max-w-full sm:flex-wrap sm:px-0';

/** Category filter links that keep the current search query (and any other filters). */
export function CategoryPills({
  categories,
  active,
  query,
  basePath = '/courses',
  keep = {},
}: {
  categories: Category[];
  active?: string;
  query?: string;
  basePath?: string;
  /** Other filters to carry over, e.g. { type: 'VIDEO' }. */
  keep?: Record<string, string | undefined>;
}) {
  const href = (category?: string) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    for (const [key, value] of Object.entries(keep)) if (value) params.set(key, value);
    if (category) params.set('category', category);
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <nav aria-label="Filter by category" className={pillRowClass}>
      <Link
        href={href()}
        className={pillClass(!active)}
        aria-current={!active ? 'page' : undefined}
      >
        All
      </Link>
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={href(category.slug)}
          className={pillClass(active === category.slug)}
          aria-current={active === category.slug ? 'page' : undefined}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
