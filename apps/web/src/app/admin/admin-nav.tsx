import Link from 'next/link';

const links = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/courses', label: 'Courses' },
  { href: '/admin/explore', label: 'Explore' },
  { href: '/admin/applications', label: 'Instructor applications' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/activity', label: 'Activity log' },
];

export function AdminNav({ current }: { current: string }) {
  return (
    <nav aria-label="Admin" className="mb-8 flex flex-wrap gap-3 border-b border-gray-300 pb-4">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={current === link.href ? 'page' : undefined}
          className={
            current === link.href
              ? 'border border-black bg-black px-4 py-2 text-sm font-semibold text-white'
              : 'border border-gray-300 px-4 py-2 text-sm font-semibold hover:border-black'
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminHeading({ title, greeting }: { title: string; greeting: string }) {
  return (
    <>
      <p className="text-sm font-semibold text-brand uppercase">{greeting}</p>
      <h1 className="mt-1 mb-6 text-3xl font-extrabold md:text-4xl">{title}</h1>
    </>
  );
}
