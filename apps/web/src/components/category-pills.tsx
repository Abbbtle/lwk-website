import Link from 'next/link';
import type { Category } from '@/lib/catalog/types';

function pillClass(active: boolean) {
  return active
    ? 'rounded-lg border-2 border-black px-4 py-2 font-medium text-black shadow-[0_3px_0_0_black]'
    : 'rounded-lg border-2 border-transparent px-4 py-2 font-medium text-gray-600 hover:text-black';
}

/** Category filter links that keep the current search query. */
export function CategoryPills({
  categories,
  active,
  query,
  basePath = '/explore',
}: {
  categories: Category[];
  active?: string;
  query?: string;
  basePath?: string;
}) {
  const href = (category?: string) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <nav aria-label="Filter by category" className="flex flex-wrap gap-3">
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
