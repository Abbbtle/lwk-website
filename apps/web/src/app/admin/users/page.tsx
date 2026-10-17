import { Search, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/server/auth/session';
import { listUsers, ROLE_LABELS, USER_FILTERS, type UserFilter } from '@/server/user-admin';
import { AdminHeading, AdminNav } from '../admin-nav';

export const metadata: Metadata = { title: 'Users', robots: { index: false } };

const filterLabels: Record<UserFilter, string> = {
  all: 'Everyone',
  admin: 'Admins',
  instructor: 'Instructors',
  support: 'Support staff',
  learner: 'Learners only',
  disabled: 'Disabled',
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function UsersPage({ searchParams }: PageProps<'/admin/users'>) {
  const session = await requireRole('admin', '/admin/users');
  const params = await searchParams;
  const query = single(params.q)?.trim() || undefined;
  const filter = USER_FILTERS.find((f) => f === single(params.filter)) ?? 'all';
  const page = Math.max(1, Number(single(params.page)) || 1);
  const { users, total, pageCount } = await listUsers({ query, filter, page });

  const href = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    const merged = { q: query, filter, page, ...changes };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== '' && !(key === 'filter' && value === 'all')) {
        if (!(key === 'page' && value === 1)) next.set(key, String(value));
      }
    }
    const qs = next.toString();
    return `/admin/users${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title="Users" greeting={session.name} />
      <AdminNav current="/admin/users" />

      <form
        action="/admin/users"
        className="mb-6 flex max-w-xl gap-2"
        role="search"
        aria-label="Users"
      >
        {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
        <label htmlFor="user-search" className="sr-only">
          Search by name or email
        </label>
        <input
          id="user-search"
          name="q"
          defaultValue={query}
          placeholder="Search by name or email"
          className="min-w-0 flex-1 border border-gray-300 bg-white px-3 py-2 focus:border-black focus:outline-none"
        />
        <button type="submit" className="btn-solid px-4" aria-label="Search">
          <Search className="size-4" aria-hidden />
        </button>
      </form>

      <nav aria-label="Filter users" className="mb-6 flex flex-wrap gap-4 text-sm font-semibold">
        {USER_FILTERS.map((f) => (
          <Link
            key={f}
            href={href({ filter: f, page: 1 })}
            aria-current={f === filter ? 'page' : undefined}
            className={f === filter ? 'text-brand-ink underline' : 'hover:text-brand-ink'}
          >
            {filterLabels[f]}
          </Link>
        ))}
      </nav>

      <p className="mb-3 text-sm text-gray-600" aria-live="polite">
        {total} {total === 1 ? 'person' : 'people'}
        {query && <> matching &ldquo;{query}&rdquo;</>}
      </p>

      {users.length === 0 ? (
        <p className="bg-white p-8 text-center text-gray-700 shadow-md">Nobody matches.</p>
      ) : (
        <div className="overflow-x-auto bg-white shadow-md">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-300 bg-gray-50 text-xs text-gray-600 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Name
                </th>
                <th scope="col" className="px-4 py-3">
                  Roles
                </th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">
                  Joined
                </th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">
                  Last sign-in
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="font-semibold hover:text-brand-ink"
                    >
                      {user.name}
                    </Link>
                    <span className="block text-gray-600">{user.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {user.roles.length === 0 && <span className="text-gray-600">Learner</span>}
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className="border border-gray-400 px-1.5 text-xs font-bold uppercase"
                        >
                          {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
                        </span>
                      ))}
                      {user.mfaEnabled && (
                        <ShieldCheck
                          className="size-4 text-green-700"
                          aria-label="Two-step verification on"
                        />
                      )}
                      {user.disabledAt && (
                        <span className="border border-red-700 px-1.5 text-xs font-bold text-red-700 uppercase">
                          Disabled
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 md:table-cell">
                    {user.createdAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 md:table-cell">
                    {user.lastSignInAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className="btn-outline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-gray-600">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={href({ page: page + 1 })} className="btn-outline">
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
