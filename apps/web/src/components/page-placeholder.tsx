import Link from 'next/link';
import type { ReactNode } from 'react';

/** Signed-in area pages whose features arrive in later phases. */
export function PagePlaceholder({
  title,
  greeting,
  children,
}: {
  title: string;
  greeting: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-brand uppercase">{greeting}</p>
      <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">{title}</h1>
      <div className="mt-8 bg-surface p-10 text-center">
        <div className="mx-auto max-w-xl text-gray-700">{children}</div>
        <Link href="/explore" className="btn-solid mt-6">
          Explore courses
        </Link>
      </div>
    </div>
  );
}
