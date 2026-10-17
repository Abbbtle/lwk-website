'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/account', label: 'Profile' },
  { href: '/account/security', label: 'Security' },
  { href: '/account/privacy', label: 'Privacy & data' },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="mb-8 flex flex-wrap gap-3 border-b border-gray-300 pb-4">
      {links.map((link) => {
        const current = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? 'page' : undefined}
            className={
              current
                ? 'border border-black bg-black px-4 py-2 text-sm font-semibold text-white'
                : 'border border-gray-300 px-4 py-2 text-sm font-semibold hover:border-black'
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
