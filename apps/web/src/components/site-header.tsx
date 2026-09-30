import Image from 'next/image';
import Link from 'next/link';
import { MainNav, type NavUser } from '@/components/main-nav';
import { SearchBar } from '@/components/search-bar';
import { site } from '@/lib/site';
import { getSession, hasRole } from '@/server/auth/session';

async function getNavUser(): Promise<NavUser | null> {
  const session = await getSession();
  if (!session) return null;
  const links = [{ href: '/my-learning', label: 'My Learning' }];
  if (hasRole(session, 'instructor')) links.push({ href: '/instructor', label: 'Instructor' });
  if (hasRole(session, 'admin')) links.push({ href: '/admin', label: 'Admin' });
  return { name: session.name, email: session.email, links };
}

export async function SiteHeader() {
  const user = await getNavUser();
  return (
    <header className="relative z-30 bg-white shadow-md">
      <nav aria-label="Main" className="flex items-center gap-4 px-4 py-2 sm:px-6 lg:gap-6">
        <Link href="/" className="shrink-0">
          <Image
            src="/logo-black.png"
            alt={site.name}
            width={1417}
            height={790}
            preload
            className="h-12 w-auto"
          />
        </Link>
        <SearchBar id="header-search" className="hidden min-w-0 flex-1 md:block" />
        <span className="flex-1 md:hidden" />
        <MainNav user={user} />
      </nav>
    </header>
  );
}
