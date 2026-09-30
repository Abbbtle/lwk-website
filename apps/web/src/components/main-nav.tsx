'use client';

import { ChevronDown, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LogoutButton } from '@/components/logout-button';
import { NotificationBell } from '@/components/notification-bell';
import { SearchBar } from '@/components/search-bar';
import { mainNav } from '@/lib/site';

export type NavUser = {
  name: string;
  email: string;
  links: { href: string; label: string }[];
  /** Unread notifications. */
  unread: number;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Close the mobile menu after navigating.
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  const linkClass = (href: string) =>
    isActive(pathname, href) ? 'text-brand' : 'text-gray-800 hover:text-brand';
  const returnTo = encodeURIComponent(pathname);

  return (
    <>
      <ul className="hidden shrink-0 items-center gap-6 xl:flex">
        {mainNav.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={linkClass(item.href)}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden shrink-0 items-center gap-3 lg:flex">
        {user && <NotificationBell unread={user.unread} />}
        {user ? (
          <details className="group relative">
            <summary className="btn-outline list-none">
              {user.name}
              <ChevronDown
                className="size-4 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-64 border border-gray-300 bg-white shadow-lg">
              <p className="truncate border-b border-gray-300 px-4 py-3 text-sm text-gray-600">
                {user.email}
              </p>
              <ul className="py-1">
                {user.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="block px-4 py-2 hover:bg-gray-100">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-300 py-1">
                <LogoutButton
                  name={user.name}
                  className="w-full cursor-pointer px-4 py-2 text-left hover:bg-gray-100"
                />
              </div>
            </div>
          </details>
        ) : (
          <>
            <a href={`/login?returnTo=${returnTo}`} className="btn-outline">
              Log In
            </a>
            <a href={`/sign-up?returnTo=${returnTo}`} className="btn-solid">
              Sign Up
            </a>
          </>
        )}
      </div>

      {user && (
        <div className="shrink-0 lg:hidden">
          <NotificationBell unread={user.unread} />
        </div>
      )}
      <button
        type="button"
        className="shrink-0 p-2 xl:hidden"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen(!open);
        }}
      >
        {open ? <X aria-hidden /> : <Menu aria-hidden />}
      </button>

      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full z-40 border-b border-gray-300 bg-white shadow-md xl:hidden"
        >
          <SearchBar id="mobile-search" className="px-4 pt-4 md:hidden" />
          <ul className="flex flex-col px-4 py-2">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={`block py-3 ${linkClass(item.href)}`}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {user ? (
            <div className="border-t border-gray-300 px-4 py-2 lg:hidden">
              <p className="py-2 text-sm text-gray-600">Signed in as {user.name}</p>
              <ul>
                {user.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={`block py-3 ${linkClass(link.href)}`}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <LogoutButton name={user.name} className="btn-outline mb-2 w-full" />
            </div>
          ) : (
            <div className="flex gap-3 px-4 pb-4 lg:hidden">
              <a href={`/login?returnTo=${returnTo}`} className="btn-outline flex-1">
                Log In
              </a>
              <a href={`/sign-up?returnTo=${returnTo}`} className="btn-solid flex-1">
                Sign Up
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}
