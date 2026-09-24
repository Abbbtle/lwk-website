import Image from 'next/image';
import Link from 'next/link';

const links = [
  { href: '/courses', label: 'Courses' },
  { href: '/about', label: 'About' },
];

export function SiteHeader() {
  return (
    <header className="border-b border-brand/30">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/lwk-logo.png" alt="" width={40} height={40} priority />
          <span className="text-lg font-semibold">Living With Krishna</span>
        </Link>
        <div className="flex items-center gap-6 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-muted hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <Link
            href="/sign-in"
            className="rounded-md bg-brand-strong px-4 py-2 font-medium text-background hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
