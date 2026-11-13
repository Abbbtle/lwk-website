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

  // Links are pills: light gray under the pointer, and the current page in saffron on a saffron
  // wash, so pointing at a link never looks like being on its page. The weight stays the same, so
  // the links do not shift when the page changes.
  const linkState = (href: string) =>
    isActive(pathname, href)
      ? 'bg-orange-50 text-brand-ink'
      : 'text-gray-700 hover:bg-gray-100 hover:text-black';
  const navLinkClass = (href: string) =>
    `inline-flex min-h-11 items-center rounded-control px-3 text-sm transition-colors duration-150 ${linkState(href)}`;
  const menuLinkClass = (href: string) =>
    `flex min-h-11 items-center rounded-control px-3 transition-colors duration-150 ${linkState(href)}`;
  const current = (href: string) => (isActive(pathname, href) ? 'page' : undefined);
  const returnTo = encodeURIComponent(pathname);

  return (
    <>
      <ul className="hidden shrink-0 items-center gap-1 xl:flex">
        {mainNav.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current(item.href)}
              className={navLinkClass(item.href)}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden shrink-0 items-center gap-2 lg:flex">
        {user && <NotificationBell unread={user.unread} />}
        {user ? (
          <details className="group relative">
            <summary className="btn-outline min-h-11 list-none px-4 py-2 text-sm">
              {user.name}
              <ChevronDown
                className="size-4 transition-transform duration-150 ease-enter group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden
              />
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-64 rounded-card border border-gray-300 bg-white shadow-raised motion-safe:animate-menu-in">
              <p className="truncate border-b border-gray-300 px-4 py-3 text-sm text-gray-600">
                {user.email}
              </p>
              <ul className="py-1">
                {user.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex min-h-11 items-center px-4 transition-colors duration-150 hover:bg-gray-100"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-300 py-1">
                <LogoutButton
                  name={user.name}
                  className="flex min-h-11 w-full cursor-pointer items-center px-4 text-left transition-colors duration-150 hover:bg-gray-100"
                />
              </div>
            </div>
          </details>
        ) : (
          <>
            <a
              href={`/login?returnTo=${returnTo}`}
              className="btn-outline min-h-11 px-4 py-2 text-sm"
            >
              Log In
            </a>
            <a
              href={`/sign-up?returnTo=${returnTo}`}
              className="btn-solid min-h-11 px-4 py-2 text-sm"
            >
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
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control transition-colors duration-150 hover:bg-gray-100 xl:hidden"
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
          className="absolute inset-x-0 top-full z-40 border-b border-gray-300 bg-white shadow-raised motion-safe:animate-panel-in xl:hidden"
        >
          {/* On the page's board, so the menu lines up with the header and the page. */}
          <div className="page-width">
            {/* The space above sits outside the search form, so its button stays centred. */}
            <div className="pt-4 md:hidden">
              <SearchBar id="mobile-search" label="Courses (menu)" />
            </div>
            <ul className="-mx-3 flex flex-col gap-1 py-3 md:max-w-sm">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current(item.href)}
                    className={menuLinkClass(item.href)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {user ? (
              <div className="border-t border-gray-300 py-2 lg:hidden">
                <p className="py-2 text-sm text-gray-600">Signed in as {user.name}</p>
                <ul className="-mx-3 flex flex-col gap-1 pb-2 md:max-w-sm">
                  {user.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={current(link.href)}
                        className={menuLinkClass(link.href)}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <LogoutButton name={user.name} className="btn-outline mb-2 w-full" />
              </div>
            ) : (
              <div className="flex gap-3 pb-4 lg:hidden">
                <a href={`/login?returnTo=${returnTo}`} className="btn-outline flex-1">
                  Log In
                </a>
                <a href={`/sign-up?returnTo=${returnTo}`} className="btn-solid flex-1">
                  Sign Up
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
