import Image from 'next/image';
import Link from 'next/link';
import { footerNav, site } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="bg-black text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <Image
            src="/logo-white.png"
            alt={site.name}
            width={1428}
            height={793}
            className="h-16 w-auto"
          />
          <p className="mt-4 max-w-sm text-sm text-gray-300">{site.description}</p>
        </div>
        {footerNav.map((group) => (
          <div key={group.title}>
            <h2 className="mb-4 text-lg font-semibold">{group.title}</h2>
            <ul className="space-y-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-brand">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-800 py-4 text-center text-sm">
        © {new Date().getFullYear()} {site.name}. All rights reserved.
      </div>
    </footer>
  );
}
