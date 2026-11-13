import { Search } from 'lucide-react';

/**
 * The header search: a soft gray pill with a hairline edge and the search button at its start (as
 * on Udemy), turning white with a saffron ring while in use. Searching opens the course catalogue.
 */
export function SearchBar({
  id,
  className = '',
  label = 'Courses',
}: {
  id: string;
  className?: string;
  /** Name of the search area, unique on the page (for screen readers). */
  label?: string;
}) {
  return (
    <form action="/courses" role="search" aria-label={label} className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        Search courses
      </label>
      <input
        id={id}
        name="q"
        type="search"
        placeholder="Search..."
        className="w-full rounded-full border border-gray-300 bg-gray-50 py-2.5 pr-5 pl-12 transition-colors duration-150 hover:border-gray-400 focus:border-gray-900 focus:bg-white focus:ring-2 focus:ring-brand focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Search"
        // A 44 px target at the start of the box, inside its height.
        className="absolute top-1/2 left-0.5 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-gray-600 transition-colors duration-150 hover:text-black"
      >
        <Search className="size-5" aria-hidden />
      </button>
    </form>
  );
}
