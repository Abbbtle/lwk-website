import Image from 'next/image';
import Link from 'next/link';
import { MainNav } from '@/components/main-nav';
import { site } from '@/lib/site';

export function SiteHeader() {
  return (
    <header className="relative border-b border-gray-300 bg-white">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8"
      >
        <Link href="/" className="shrink-0">
          <Image
            src="/logo-black.png"
            alt={site.name}
            width={1417}
            height={790}
            preload
            className="h-14 w-auto"
          />
        </Link>
        <MainNav />
      </nav>
    </header>
  );
}
