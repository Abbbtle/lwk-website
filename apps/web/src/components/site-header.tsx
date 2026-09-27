import Image from 'next/image';
import Link from 'next/link';
import { MainNav, type NavUser } from '@/components/main-nav';
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
        <MainNav user={user} />
      </nav>
    </header>
  );
}
