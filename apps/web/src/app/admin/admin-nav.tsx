import Link from 'next/link';
import { getSession, hasRole, type Role } from '@/server/auth/session';

const links: { href: string; label: string; role: Role }[] = [
  { href: '/admin', label: 'Overview', role: 'admin' },
  { href: '/admin/users', label: 'Users', role: 'admin' },
  { href: '/admin/courses', label: 'Courses', role: 'admin' },
  { href: '/admin/explore', label: 'Explore', role: 'admin' },
  { href: '/admin/applications', label: 'Instructor applications', role: 'admin' },
  { href: '/admin/support', label: 'Support', role: 'support' },
  { href: '/admin/ai', label: 'AI', role: 'admin' },
  { href: '/admin/messages', label: 'Messages', role: 'admin' },
  { href: '/admin/activity', label: 'Activity log', role: 'admin' },
];

/** Admin area tabs; support staff only see what they can use. */
export async function AdminNav({ current }: { current: string }) {
  const session = await getSession();
  const visible = links.filter((link) => session && hasRole(session, link.role));
  return (
    <nav aria-label="Admin" className="mb-8 flex flex-wrap gap-3 border-b border-gray-300 pb-4">
      {visible.map((link) => (
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
