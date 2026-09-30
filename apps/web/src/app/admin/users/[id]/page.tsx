import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmAction } from '@/components/confirm-action';
import { StatusBadge } from '@/components/status-badge';
import { listAuditEvents } from '@/server/audit';
import { requireRole, ROLES } from '@/server/auth/session';
import { getUserDetail, ROLE_LABELS } from '@/server/user-admin';
import { AdminHeading, AdminNav } from '../../admin-nav';
import { changeAccountStatus, changeRole, resetUserTwoStep, signOutUser } from '../actions';

export const metadata: Metadata = { title: 'User', robots: { index: false } };

const roleHelp: Record<(typeof ROLES)[number], string> = {
  admin:
    'Full access: users, reviews, applications and messages. Needs two-step verification to use.',
  instructor: 'Can create courses and submit them for review.',
  support: 'Can answer support requests in the admin area. Needs two-step verification to use.',
};

const dateTime = (date: Date) =>
  date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default async function UserPage({ params }: PageProps<'/admin/users/[id]'>) {
  const { id } = await params;
  const session = await requireRole('admin', `/admin/users/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getUserDetail(session, id);
  if (!user) notFound();
  const { events } = await listAuditEvents({ targetType: 'user', targetId: id });
  const isSelf = user.id === session.userId;
  const disabled = user.account ? !user.account.enabled : Boolean(user.disabledAt);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title={user.name} greeting="User" />
      <AdminNav current="/admin/users" />
      <Link
        href="/admin/users"
        className="mb-6 inline-flex items-center gap-2 text-sm hover:text-brand-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> All users
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold">Roles</h2>
            <p className="mt-2 text-sm text-gray-600">
              Every account can learn. Changes apply to their current session straight away.
            </p>
            <ul className="mt-5 divide-y divide-gray-200">
              {ROLES.map((role) => {
                const has = user.roles.includes(role);
                const blockedSelf = isSelf && role === 'admin' && has;
                return (
                  <li key={role} className="flex flex-wrap items-start justify-between gap-4 py-4">
                    <div className="max-w-md">
                      <p className="font-semibold">
                        {ROLE_LABELS[role]}{' '}
                        <span className={has ? 'text-green-800' : 'text-gray-500'}>
                          · {has ? 'Yes' : 'No'}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600">{roleHelp[role]}</p>
                    </div>
                    {blockedSelf ? (
                      <p className="text-sm text-gray-600">
                        You cannot remove your own admin role.
                      </p>
                    ) : (
                      <ConfirmAction
                        label={
                          has
                            ? `Remove ${ROLE_LABELS[role].toLowerCase()} role`
                            : `Make ${ROLE_LABELS[role].toLowerCase()}`
                        }
                        question={
                          has
                            ? `Remove the ${ROLE_LABELS[role]} role from ${user.name}? They lose access immediately.`
                            : `Give ${user.name} the ${ROLE_LABELS[role]} role? ${roleHelp[role]}`
                        }
                        confirmLabel={has ? 'Remove role' : 'Give role'}
                        tone={has ? 'danger' : 'default'}
                        action={changeRole.bind(null, user.id, role, !has)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold">Learning</h2>
            <p className="mt-2 text-sm text-gray-600">
              {user._count.enrollments} {user._count.enrollments === 1 ? 'course' : 'courses'}{' '}
              enrolled
            </p>
            {user.enrollments.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm">
                {user.enrollments.map((e) => (
                  <li key={e.id} className="flex flex-wrap justify-between gap-2">
                    <Link href={`/courses/${e.course.slug}`} className="hover:text-brand-ink">
                      {e.course.title}
                    </Link>
                    <span className="text-gray-600">
                      {e.completedAt
                        ? 'Completed'
                        : `Active ${e.lastActiveAt.toLocaleDateString('en-GB')}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {user.coursesTaught.length > 0 && (
              <>
                <h3 className="mt-6 font-semibold">Courses they teach</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {user.coursesTaught.map((course) => (
                    <li
                      key={course.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <Link href={`/admin/courses/${course.id}`} className="hover:text-brand-ink">
                        {course.title}
                      </Link>
                      <StatusBadge status={course.status} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold">Activity</h2>
            {events.length === 0 ? (
              <p className="mt-3 text-sm text-gray-600">No recorded changes yet.</p>
            ) : (
              <ol className="mt-4 space-y-3 text-sm">
                {events.map((event) => (
                  <li key={event.id} className="border-l-2 border-gray-300 pl-3">
                    <p>{event.summary}</p>
                    <p className="text-gray-600">
                      {event.actorName} · {dateTime(event.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-8">
          <section className="bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold">Account</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-gray-600">Email</dt>
                <dd className="font-semibold break-all">{user.email}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Status</dt>
                <dd className={`font-semibold ${disabled ? 'text-red-700' : ''}`}>
                  {disabled
                    ? 'Disabled'
                    : user.account?.status === 'CONFIRMED'
                      ? 'Active'
                      : (user.account?.status ?? 'Unknown')}
                </dd>
              </div>
              <div>
                <dt className="text-gray-600">Two-step verification</dt>
                <dd className="font-semibold">{user.mfaEnabled ? 'On' : 'Off'}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Joined</dt>
                <dd>{dateTime(user.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Last sign-in</dt>
                <dd>{dateTime(user.lastSignInAt)}</dd>
              </div>
            </dl>
          </section>

          {!isSelf && (
            <section className="space-y-5 bg-white p-6 shadow-md">
              <h2 className="text-xl font-bold">Actions</h2>
              <ConfirmAction
                label="Sign out everywhere"
                question={`Sign ${user.name} out on every device? They can log in again straight away.`}
                confirmLabel="Sign out"
                action={signOutUser.bind(null, user.id)}
              />
              {user.mfaEnabled && (
                <ConfirmAction
                  label="Reset two-step verification"
                  question={`Only do this if you are sure it is really ${user.name} asking (for example, they lost their phone). They will log in with just their password until they set it up again.`}
                  confirmLabel="Reset"
                  action={resetUserTwoStep.bind(null, user.id)}
                />
              )}
              {disabled ? (
                <ConfirmAction
                  label="Enable account"
                  question={`Let ${user.name} log in again?`}
                  confirmLabel="Enable"
                  action={changeAccountStatus.bind(null, user.id, true)}
                />
              ) : (
                <ConfirmAction
                  label="Disable account"
                  question={`Disable ${user.name}'s account? They are signed out at once and cannot log in until an admin enables the account again. Their data is kept.`}
                  confirmLabel="Disable"
                  tone="danger"
                  action={changeAccountStatus.bind(null, user.id, false)}
                />
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
