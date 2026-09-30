import Image from 'next/image';
import Link from 'next/link';
import { SocialIcons } from '@/components/social-icons';
import { footerNav, site } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="bg-black text-white">
      <div className="grid gap-10 px-8 pt-12 pb-10 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/" className="justify-self-center sm:justify-self-start">
          <Image
            src="/logo-white.png"
            alt={site.name}
            width={1428}
            height={793}
            className="h-24 w-auto md:h-28"
          />
        </Link>
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
        <div>
          <h2 className="mb-4 text-lg font-semibold">Follow Us</h2>
          <SocialIcons />
          <p className="mt-4 text-sm">{site.description}</p>
        </div>
      </div>
      <p className="pb-6 text-center text-sm">
        © {new Date().getFullYear()} {site.name}. All rights reserved.
      </p>
    </footer>
  );
}
