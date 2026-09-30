import Image from 'next/image';
import Link from 'next/link';
import { MainNav, type NavUser } from '@/components/main-nav';
import { SearchBar } from '@/components/search-bar';
import { site } from '@/lib/site';
import { getSession, hasRole } from '@/server/auth/session';
import { unreadCount } from '@/server/notifications';

async function getNavUser(): Promise<NavUser | null> {
  const session = await getSession();
  if (!session) return null;
  const links = [{ href: '/my-learning', label: 'My Learning' }];
  if (hasRole(session, 'instructor')) links.push({ href: '/instructor', label: 'Instructor' });
  if (hasRole(session, 'admin')) links.push({ href: '/admin', label: 'Admin' });
  else if (hasRole(session, 'support'))
    links.push({ href: '/admin/support', label: 'Support inbox' });
  if (session.lockedRoles.length > 0) {
    links.push({
      href: '/account/security?required=staff',
      label: 'Staff tools (set up two-step verification)',
    });
  }
  links.push(
    { href: '/notifications', label: 'Notifications' },
    { href: '/support', label: 'Help & support' },
    { href: '/account', label: 'Account' },
  );
  return {
    name: session.name,
    email: session.email,
    links,
    unread: await unreadCount(session.userId),
  };
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
