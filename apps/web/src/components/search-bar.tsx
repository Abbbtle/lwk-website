import { Search } from 'lucide-react';

/** Pill search box from the POC header; searching opens the course catalogue. */
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
        className="w-full rounded-full border border-black bg-white py-2.5 pr-11 pl-5 focus:ring-2 focus:ring-brand focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer text-gray-500 hover:text-black"
      >
        <Search className="size-5" aria-hidden />
      </button>
    </form>
  );
}
