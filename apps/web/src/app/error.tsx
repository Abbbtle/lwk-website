'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Shown when a page fails to load. Offers a retry and a way to tell us, with the page filled in.
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const report = `/support/new?category=TECHNICAL&from=${encodeURIComponent(pathname)}`;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-5xl font-extrabold text-brand">Oops</p>
      <h1 className="mt-4 text-3xl font-extrabold">Something went wrong</h1>
      <p className="mt-3 text-gray-700">
        This page could not be shown just now. Please try again; if it keeps happening, let us know
        and we will look into it.
      </p>
      {error.digest && <p className="mt-2 text-xs text-gray-500">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-solid">
          Try again
        </button>
        <Link href="/" className="btn-outline">
          Go home
        </Link>
        <Link href={report} className="btn-outline">
          Report a problem
        </Link>
      </div>
    </div>
  );
}
