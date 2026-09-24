'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { mainNav } from '@/lib/site';

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Close the mobile menu after navigating.
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  const linkClass = (href: string) =>
    isActive(pathname, href) ? 'text-brand' : 'text-gray-800 hover:text-brand';

  return (
    <>
      <ul className="hidden items-center gap-6 lg:flex">
        {mainNav.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={linkClass(item.href)}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden items-center gap-3 lg:flex">
        <Link href="/login" className="btn-outline">
          Log In
        </Link>
        <Link href="/sign-up" className="btn-solid">
          Sign Up
        </Link>
      </div>

      <button
        type="button"
        className="p-2 lg:hidden"
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
          className="absolute inset-x-0 top-full z-40 border-b border-gray-300 bg-white lg:hidden"
        >
          <ul className="flex flex-col px-4 py-2">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={`block py-3 ${linkClass(item.href)}`}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex gap-3 px-4 pb-4">
            <Link href="/login" className="btn-outline flex-1">
              Log In
            </Link>
            <Link href="/sign-up" className="btn-solid flex-1">
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
