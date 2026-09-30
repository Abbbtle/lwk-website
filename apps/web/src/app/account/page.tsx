import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/server/auth/session';
import { getDb } from '@/server/db';
import { ROLE_LABELS } from '@/server/user-admin';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const session = await requireSession('/account');
  const user = await getDb().user.findUnique({
    where: { id: session.userId },
    select: { createdAt: true },
  });
  const roles = [
    'Learner',
    ...session.roles.map((role) => ROLE_LABELS[role]),
    ...(session.adminNeedsMfa ? ['Admin (locked until two-step verification is on)'] : []),
  ];

  return (
    <div className="space-y-8">
      <section className="bg-white p-6 shadow-md sm:p-8">
        <h2 className="text-xl font-bold">Profile</h2>
        <div className="mt-6">
          <ProfileForm name={session.name} />
        </div>
      </section>

      <section className="bg-white p-6 shadow-md sm:p-8">
        <h2 className="text-xl font-bold">Account details</h2>
        <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-600">Email</dt>
            <dd className="font-semibold break-all">{session.email}</dd>
            <dd className="mt-1 text-sm text-gray-600">
              To change your email address,{' '}
              <Link href="/contact" className="underline hover:text-brand">
                contact support
              </Link>
              .
            </dd>
          </div>
          {user && (
            <div>
              <dt className="text-sm text-gray-600">Member since</dt>
              <dd className="font-semibold">
                {user.createdAt.toLocaleDateString('en-GB', { dateStyle: 'long' })}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-gray-600">Roles</dt>
            <dd className="font-semibold">{roles.join(', ')}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Two-step verification</dt>
            <dd className="font-semibold">
              {session.mfaEnabled ? 'On' : 'Off'} ·{' '}
              <Link href="/account/security" className="font-normal underline hover:text-brand">
                Manage
              </Link>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
